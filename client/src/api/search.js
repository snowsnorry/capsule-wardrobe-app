import { API_BASE_URL } from "./config.js";
import { getCachedJson, requestJson } from "./request";

async function fetchSearchOptions({ force = false } = {}) {
  return getCachedJson(`${API_BASE_URL}/search/options`, {
    credentials: "include",
    ttlMs: 1000,
    force
  });
}

async function fetchSavedSearch({ force = false } = {}) {
  return getCachedJson(`${API_BASE_URL}/search/me`, {
    credentials: "include",
    ttlMs: 1000,
    force
  });
}

async function runSearch(payload) {
  return requestJson(`${API_BASE_URL}/search/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
}

async function fetchSearchStats(payload) {
  return requestJson(`${API_BASE_URL}/search/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
}

export { fetchSearchOptions, fetchSavedSearch, fetchSearchStats, runSearch };
