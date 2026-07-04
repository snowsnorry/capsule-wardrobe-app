import type { SearchOptions } from "./searchTypes.js";

type ProductSearchOptions = Omit<SearchOptions, "audience" | "styles">;

type SearchOptionsCacheDeps = {
  getDistinctProductBrandsImpl: () => Promise<SearchOptions["brands"]>;
  getDistinctProductCategoriesImpl: () => Promise<string[]>;
  getDistinctProductSeasonsImpl: () => Promise<string[]>;
  getDistinctProductFormalityLevelsImpl: () => Promise<string[]>;
  getDistinctProductOccasionsImpl: () => Promise<string[]>;
  getDistinctProductColorsImpl: () => Promise<string[]>;
  getDistinctProductPatternsImpl: () => Promise<string[]>;
  getDistinctProductSilhouettesImpl: () => Promise<string[]>;
  getDistinctProductFitsImpl: () => Promise<string[]>;
  getDistinctProductClosureTypesImpl: () => Promise<string[]>;
  getProductPriceRangeImpl: () => Promise<unknown>;
  getStylesImpl: (email: string) => Promise<string[]>;
};

type ProductOptionsCacheState = {
  forcePending: Promise<ProductSearchOptions> | null;
  latestRebuildId: number;
  pending: Promise<ProductSearchOptions> | null;
  stale: boolean;
  staleVersion: number;
  value: ProductSearchOptions | null;
};

type StylesCacheEntry = {
  expiresAt: number;
  forcePending: Promise<string[]> | null;
  pending: Promise<string[]> | null;
  value: string[] | null;
};

type SearchOptionsCacheOptions = {
  now?: () => number;
  stylesTtlMs?: number;
  stylesMaxEntries?: number;
};

const DEFAULT_STYLES_TTL_MS = 60 * 60 * 1000;
const DEFAULT_STYLES_MAX_ENTRIES = 500;

type StylesRebuildInput = {
  cache: Map<string, StylesCacheEntry>;
  current: StylesCacheEntry | undefined;
  deps: SearchOptionsCacheDeps;
  email: string;
  force: boolean;
  key: string;
  maxEntries: number;
  now: () => number;
  ttlMs: number;
};

function normalizeEmailKey(email: string) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function trimCacheToMaxSize<TKey, TValue>(
  cache: Map<TKey, TValue>,
  maxSize: number,
) {
  while (cache.size > maxSize) {
    const firstKey = cache.keys().next().value;
    if (firstKey === undefined) return;
    cache.delete(firstKey);
  }
}

function getFreshStylesValue(
  cache: Map<string, StylesCacheEntry>,
  key: string,
  entry: StylesCacheEntry | undefined,
  nowMs: number,
) {
  if (!entry?.value || entry.expiresAt <= nowMs) {
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function createProductOptionsCacheState(): ProductOptionsCacheState {
  return {
    forcePending: null,
    latestRebuildId: 0,
    pending: null,
    stale: true,
    staleVersion: 0,
    value: null,
  };
}

async function buildProductOptions(
  deps: SearchOptionsCacheDeps,
): Promise<ProductSearchOptions> {
  const [
    brands,
    categories,
    seasons,
    formalityLevels,
    occasions,
    colors,
    patterns,
    silhouettes,
    fits,
    closureTypes,
    priceRange,
  ] = await Promise.all([
    deps.getDistinctProductBrandsImpl(),
    deps.getDistinctProductCategoriesImpl(),
    deps.getDistinctProductSeasonsImpl(),
    deps.getDistinctProductFormalityLevelsImpl(),
    deps.getDistinctProductOccasionsImpl(),
    deps.getDistinctProductColorsImpl(),
    deps.getDistinctProductPatternsImpl(),
    deps.getDistinctProductSilhouettesImpl(),
    deps.getDistinctProductFitsImpl(),
    deps.getDistinctProductClosureTypesImpl(),
    deps.getProductPriceRangeImpl(),
  ]);

  return {
    brands,
    categories,
    seasons,
    formalityLevels,
    occasions,
    colors,
    patterns,
    silhouettes,
    fits,
    closureTypes,
    priceRange: priceRange as SearchOptions["priceRange"],
  };
}

function cleanupProductOptionsPending(
  cache: ProductOptionsCacheState,
  pending: Promise<ProductSearchOptions>,
) {
  if (cache.pending === pending) {
    cache.pending = null;
  }
  if (cache.forcePending === pending) {
    cache.forcePending = null;
  }
}

function rebuildProductOptions(
  deps: SearchOptionsCacheDeps,
  cache: ProductOptionsCacheState,
  { force = false } = {},
) {
  const staleVersionAtStart = cache.staleVersion;
  const rebuildId = cache.latestRebuildId + 1;
  cache.latestRebuildId = rebuildId;
  const pending = buildProductOptions(deps);
  cache.pending = pending;
  if (force) {
    cache.forcePending = pending;
  }
  void pending
    .finally(() => cleanupProductOptionsPending(cache, pending))
    .catch(() => undefined);

  return pending.then((value) => {
    if (cache.latestRebuildId === rebuildId) {
      cache.value = value;
      cache.stale = cache.staleVersion !== staleVersionAtStart;
    }
    return value;
  });
}

function getReusableProductOptions(
  cache: ProductOptionsCacheState,
  force: boolean,
) {
  if (!force && cache.value && !cache.stale) {
    return cache.value;
  }
  if (force && cache.forcePending) {
    return cache.forcePending;
  }
  return !force && cache.pending ? cache.pending : null;
}

function getReusableStylesResult(
  cache: Map<string, StylesCacheEntry>,
  key: string,
  entry: StylesCacheEntry | undefined,
  force: boolean,
  nowMs: number,
) {
  if (force) {
    return entry?.forcePending || null;
  }
  return (
    getFreshStylesValue(cache, key, entry, nowMs) || entry?.pending || null
  );
}

async function rebuildStyles({
  cache,
  current,
  deps,
  email,
  force,
  key,
  maxEntries,
  now,
  ttlMs,
}: StylesRebuildInput) {
  const pending = deps.getStylesImpl(email);
  const entry: StylesCacheEntry = {
    expiresAt: now() + ttlMs,
    forcePending: force ? pending : null,
    pending,
    value: current?.value || null,
  };
  cache.set(key, entry);
  trimCacheToMaxSize(cache, maxEntries);
  try {
    const value = await pending;
    entry.value = value;
    entry.expiresAt = now() + ttlMs;
    return value;
  } finally {
    if (entry.pending === pending) {
      entry.pending = null;
    }
    if (entry.forcePending === pending) {
      entry.forcePending = null;
    }
  }
}

function createSearchOptionsCache(
  deps: SearchOptionsCacheDeps,
  options: SearchOptionsCacheOptions = {},
) {
  const now = options.now || Date.now;
  const stylesTtlMs = options.stylesTtlMs ?? DEFAULT_STYLES_TTL_MS;
  const stylesMaxEntries =
    options.stylesMaxEntries ?? DEFAULT_STYLES_MAX_ENTRIES;
  const productCache = createProductOptionsCacheState();
  const stylesCache = new Map<string, StylesCacheEntry>();

  async function getProductOptions({ force = false } = {}) {
    const reusable = getReusableProductOptions(productCache, force);
    if (reusable) {
      return reusable;
    }

    return rebuildProductOptions(deps, productCache, { force });
  }

  async function getStyles(email: string, { force = false } = {}) {
    const key = normalizeEmailKey(email);
    const current = stylesCache.get(key);
    const reusable = getReusableStylesResult(
      stylesCache,
      key,
      current,
      force,
      now(),
    );
    if (reusable) {
      return reusable;
    }

    return rebuildStyles({
      cache: stylesCache,
      current,
      deps,
      email,
      force,
      key,
      maxEntries: stylesMaxEntries,
      now,
      ttlMs: stylesTtlMs,
    });
  }

  function markProductOptionsStale() {
    productCache.staleVersion += 1;
    productCache.stale = true;
  }

  function clear() {
    productCache.forcePending = null;
    productCache.latestRebuildId += 1;
    productCache.pending = null;
    productCache.stale = true;
    productCache.staleVersion += 1;
    productCache.value = null;
    stylesCache.clear();
  }

  return {
    clear,
    getProductOptions,
    getStyles,
    markProductOptionsStale,
  };
}

export { createSearchOptionsCache };
