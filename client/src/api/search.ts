import { API_BASE_URL } from "./config";
import { getCachedJson, requestJson } from "./request";
import type { JsonObject } from "./request";

type SearchResponse = JsonObject;
type SearchRequestPayload = Record<string, unknown>;
type SearchFetchOptions = {
  force?: boolean;
};

async function fetchSearchOptions({ force = false }: SearchFetchOptions = {}): Promise<SearchResponse> {
  return getCachedJson(`${API_BASE_URL}/search/options`, {
    credentials: "include",
    ttlMs: 1000,
    force
  });
}

async function fetchSavedSearch({ force = false }: SearchFetchOptions = {}): Promise<SearchResponse> {
  return getCachedJson(`${API_BASE_URL}/search/me`, {
    credentials: "include",
    ttlMs: 1000,
    force
  });
}

async function runSearch(payload: SearchRequestPayload): Promise<SearchResponse> {
  return requestJson(`${API_BASE_URL}/search/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
}

async function fetchSearchStats(payload: SearchRequestPayload): Promise<SearchResponse> {
  return requestJson(`${API_BASE_URL}/search/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
}

export { fetchSearchOptions, fetchSavedSearch, fetchSearchStats, runSearch };
