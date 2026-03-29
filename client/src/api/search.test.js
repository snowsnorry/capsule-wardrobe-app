import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCachedJson: vi.fn(),
  requestJson: vi.fn()
}));

vi.mock("./request.js", () => requestApi);
vi.mock("./config.js", () => ({
  API_BASE_URL: "https://api.example.test"
}));

import { fetchSavedSearch, fetchSearchOptions, runSearch } from "./search.js";

describe("search api", () => {
  beforeEach(() => {
    requestApi.getCachedJson.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.getCachedJson.mockResolvedValue({});
    requestApi.requestJson.mockResolvedValue({});
  });

  test("fetchSearchOptions uses cached GET contract and forwards force flag", async () => {
    await fetchSearchOptions();
    await fetchSearchOptions({ force: true });

    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/search/options",
      {
        credentials: "include",
        ttlMs: 1000,
        force: false
      }
    );
    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/search/options",
      {
        credentials: "include",
        ttlMs: 1000,
        force: true
      }
    );
  });

  test("fetchSavedSearch uses cached authenticated contract and forwards force flag", async () => {
    await fetchSavedSearch();
    await fetchSavedSearch({ force: true });

    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/search/me",
      {
        credentials: "include",
        ttlMs: 1000,
        force: false
      }
    );
    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/search/me",
      {
        credentials: "include",
        ttlMs: 1000,
        force: true
      }
    );
  });

  test("runSearch posts serialized payload to the authenticated search endpoint", async () => {
    const payload = {
      query: "linen shirt",
      brand: ["uniqlo"],
      page: 2
    };

    await runSearch(payload);

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/search/run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      }
    );
  });

  test("runSearch passes through requestJson response payload", async () => {
    requestApi.requestJson.mockResolvedValue({
      items: [{ id: "product-1" }],
      total: 1,
      savedSearch: { page: 1 }
    });

    await expect(runSearch({ query: "dress" })).resolves.toEqual({
      items: [{ id: "product-1" }],
      total: 1,
      savedSearch: { page: 1 }
    });
  });
});
