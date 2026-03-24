const inFlight = new Map();
const cache = new Map();
const CSRF_HEADER = "X-CSRF-Token";

function getCacheKey(url, options) {
  const method = options?.method || "GET";
  return `${method}:${url}`;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readResponseBody(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
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

async function requestJson(url, options = {}) {
  const response = await request(url, options);
  const data = await readResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `request_failed_${response.status}`
    );
    error.data = data;
    error.status = response.status;
    throw error;
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data;
  }

  return {};
}

async function request(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (isStateChanging && !headers.has(CSRF_HEADER) && typeof document !== "undefined") {
    const csrfToken = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("csrf="))
      ?.slice("csrf=".length);
    if (csrfToken) {
      headers.set(CSRF_HEADER, decodeURIComponent(csrfToken));
    }
  }

  return fetch(url, {
    ...options,
    method,
    headers
  });
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

export { request, requestJson, getCachedJson, clearRequestCache };
