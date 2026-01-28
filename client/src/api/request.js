const inFlight = new Map();
const cache = new Map();

function getCacheKey(url, options) {
  const method = options?.method || "GET";
  return `${method}:${url}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "request_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function getCachedJson(url, { ttlMs = 1000, force = false, ...options } = {}) {
  const key = getCacheKey(url, options);
  const now = Date.now();
  const cached = cache.get(key);
  if (!force && cached && now - cached.timestamp < ttlMs) {
    return cached.value;
  }

  if (!inFlight.has(key)) {
    const promise = requestJson(url, options)
      .then((value) => {
        cache.set(key, { value, timestamp: Date.now() });
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, promise);
  }

  return inFlight.get(key);
}

function clearRequestCache() {
  cache.clear();
  inFlight.clear();
}

export { requestJson, getCachedJson, clearRequestCache };
