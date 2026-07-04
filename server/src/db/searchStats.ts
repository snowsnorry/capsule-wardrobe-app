import { getSqlClient, stableStringify } from "./core.js";
import {
  SEARCH_STATS_CACHE_MAX_ENTRIES,
  SEARCH_STATS_CACHE_TTL_MS,
  SEARCH_STATS_QUERY_CONCURRENCY,
} from "./searchStatsConfig.js";
import { normalizeSearchStatsInput } from "./searchStatsNormalize.js";
import { buildStatsResult, createStatsTasks } from "./searchStatsQueries.js";
import type {
  SearchStatsCacheEntry,
  SearchStatsInput,
  SearchStatsResult,
} from "./searchStatsTypes.js";

const searchStatsCache = new Map<string, SearchStatsCacheEntry>();

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );
  return results;
}

function getCachedStatsValue(
  cacheKey: string,
  cached: SearchStatsCacheEntry | undefined,
  now: number,
) {
  if (cached?.value && cached.expiresAt > now) {
    searchStatsCache.delete(cacheKey);
    searchStatsCache.set(cacheKey, cached);
    return cached.value;
  }
  return cached?.pending || null;
}

function trimSearchStatsCache() {
  while (searchStatsCache.size > SEARCH_STATS_CACHE_MAX_ENTRIES) {
    const firstKey = searchStatsCache.keys().next().value;
    if (firstKey === undefined) return;
    searchStatsCache.delete(firstKey);
  }
}

function restoreFailedStatsCacheRefresh(
  cacheKey: string,
  entry: SearchStatsCacheEntry,
  cached: SearchStatsCacheEntry | undefined,
) {
  if (searchStatsCache.get(cacheKey) !== entry) {
    return;
  }
  if (!cached?.value) {
    searchStatsCache.delete(cacheKey);
    return;
  }
  searchStatsCache.set(cacheKey, {
    expiresAt: cached.expiresAt,
    pending: null,
    value: cached.value,
  });
}

async function resolveStatsPending({
  cacheKey,
  cached,
  entry,
  pending,
}: {
  cacheKey: string;
  cached: SearchStatsCacheEntry | undefined;
  entry: SearchStatsCacheEntry;
  pending: Promise<SearchStatsResult>;
}) {
  let succeeded = false;
  try {
    const value = await pending;
    succeeded = true;
    entry.value = value;
    entry.expiresAt = Date.now() + SEARCH_STATS_CACHE_TTL_MS;
    return value;
  } finally {
    if (entry.pending === pending) {
      entry.pending = null;
    }
    if (!succeeded) {
      restoreFailedStatsCacheRefresh(cacheKey, entry, cached);
    }
  }
}

export async function searchProductStats(
  input: SearchStatsInput = {},
): Promise<SearchStatsResult> {
  const sql = getSqlClient();
  const filters = normalizeSearchStatsInput(input);
  const cacheKey = stableStringify(filters);
  const now = Date.now();
  const cached = searchStatsCache.get(cacheKey);
  const cachedValue = getCachedStatsValue(cacheKey, cached, now);
  if (cachedValue) {
    return cachedValue;
  }

  const pending = runWithConcurrency(
    createStatsTasks(sql, filters),
    SEARCH_STATS_QUERY_CONCURRENCY,
  ).then(buildStatsResult);
  const entry: SearchStatsCacheEntry = {
    expiresAt: cached?.expiresAt || 0,
    pending,
    value: cached?.value || null,
  };
  searchStatsCache.set(cacheKey, entry);
  trimSearchStatsCache();

  return resolveStatsPending({ cacheKey, cached, entry, pending });
}

export function clearSearchProductStatsCache() {
  searchStatsCache.clear();
}
