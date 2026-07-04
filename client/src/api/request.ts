type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = Record<string, unknown>;
type JsonArray = JsonValue[];
type RequestErrorData = JsonValue;
type RequestError = Error & {
  data: RequestErrorData;
  status: number;
};
type CacheEntry = {
  timestamp: number;
  ttlMs: number;
  value: JsonObject;
};
type CachedJsonOptions = RequestInit & {
  force?: boolean;
  ttlMs?: number;
};
type ResponseLike = Pick<Response, "ok" | "status" | "text"> & {
  headers: Pick<Headers, "get">;
};

const inFlight = new Map<string, Promise<JsonObject>>();
const cache = new Map<string, CacheEntry>();
const CSRF_HEADER = "X-CSRF-Token";
const MAX_CACHE_ENTRIES = 200;

function getCacheKey(url: string, options?: RequestInit) {
  const method = options?.method || "GET";
  return `${method}:${url}`;
}

function isCacheEntryFresh(
  entry: CacheEntry,
  now: number,
  ttlMs = entry.ttlMs,
) {
  return now - entry.timestamp < ttlMs;
}

function getFreshCachedValue(key: string, now: number): JsonObject | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (!isCacheEntryFresh(cached, now)) {
    cache.delete(key);
    return null;
  }

  cache.delete(key);
  cache.set(key, cached);
  return cached.value;
}

function pruneExpiredCacheEntries(now: number) {
  for (const [key, entry] of cache) {
    if (!isCacheEntryFresh(entry, now)) {
      cache.delete(key);
    }
  }
}

function trimCacheToMaxSize() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function setCachedValue(
  key: string,
  value: JsonObject,
  timestamp: number,
  ttlMs: number,
) {
  cache.delete(key);
  cache.set(key, { value, timestamp, ttlMs });
  pruneExpiredCacheEntries(timestamp);
  trimCacheToMaxSize();
}

function tryParseJson(text: string): JsonValue | null {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return null;
  }
}

async function readResponseBody(
  response: ResponseLike,
): Promise<JsonValue | JsonObject | null> {
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  const text = await response.text();
  if (!text) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return tryParseJson(text);
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    return tryParseJson(text);
  }

  return { raw: text };
}

function getErrorMessage(data: JsonValue | null, status: number): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const error = data.error;
    if (typeof error === "string" && error) {
      return error;
    }

    const message = data.message;
    if (typeof message === "string" && message) {
      return message;
    }
  }

  return `request_failed_${status}`;
}

function getCsrfHeader(): Record<string, string> {
  if (typeof document === "undefined") {
    return {};
  }

  let cookie: string;
  try {
    cookie = document.cookie;
  } catch {
    return {};
  }

  const csrfToken = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrf="))
    ?.slice("csrf=".length);

  return csrfToken ? { [CSRF_HEADER]: decodeURIComponent(csrfToken) } : {};
}

async function requestJson(
  url: string,
  options: RequestInit = {},
): Promise<JsonObject> {
  const response = await request(url, options);
  const data = await readResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      getErrorMessage(data, response.status),
    ) as RequestError;
    error.data = data;
    error.status = response.status;
    throw error;
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data;
  }

  return {};
}

async function request(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (
    isStateChanging &&
    !headers.has(CSRF_HEADER) &&
    typeof document !== "undefined"
  ) {
    const csrfHeader = getCsrfHeader();
    const csrfToken = csrfHeader[CSRF_HEADER];
    if (csrfToken) {
      headers.set(CSRF_HEADER, csrfToken);
    }
  }

  return fetch(url, {
    ...options,
    method,
    headers,
  });
}

async function getCachedJson(
  url: string,
  { ttlMs = 1000, force = false, ...options }: CachedJsonOptions = {},
): Promise<JsonObject> {
  const key = getCacheKey(url, options);
  const now = Date.now();
  if (!force) {
    const cachedValue = getFreshCachedValue(key, now);
    if (cachedValue) {
      return cachedValue;
    }
  }

  if (force || !inFlight.has(key)) {
    const promise = requestJson(url, options)
      .then((value) => {
        if (inFlight.get(key) === promise) {
          setCachedValue(key, value, Date.now(), ttlMs);
        }
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === promise) {
          inFlight.delete(key);
        }
      });
    inFlight.set(key, promise);
  }

  return inFlight.get(key) as Promise<JsonObject>;
}

function clearRequestCache() {
  cache.clear();
  inFlight.clear();
}

export { request, requestJson, getCachedJson, clearRequestCache };
export type { JsonObject };
