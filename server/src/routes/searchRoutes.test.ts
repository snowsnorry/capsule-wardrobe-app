import { test, expect, vi } from "vitest";
import type { ErrorWithCode } from "../ai/types.js";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

test("search routes expose options, saved search, run, and stats", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const searchOptions = await requestJson(baseUrl, "/search/options", {
    cookie: AUTH_COOKIE,
  });
  expect(searchOptions.response.status).toBe(200);
  expect(searchOptions.json.ok).toBe(true);
  expect(searchOptions.json.audience).toEqual(["woman", "man", "all"]);

  const savedSearch = await requestJson(baseUrl, "/search/me", {
    cookie: AUTH_COOKIE,
  });
  expect(savedSearch.response.status).toBe(200);
  expect(savedSearch.json).toEqual({
    ok: true,
    search: { query: "coat", page: 1 },
  });

  const productDetail = await requestJson(
    baseUrl,
    "/search/product?url=https%3A%2F%2Fexample.com%2F1",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(productDetail.response.status).toBe(200);
  expect(productDetail.json).toEqual({
    ok: true,
    item: { url: "https://example.com/1", isLiked: false },
  });

  const searchRun = await requestJson(baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" },
  });
  expect(searchRun.response.status).toBe(200);
  expect(searchRun.json.ok).toBe(true);

  const searchStats = await requestJson(baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { category: ["top"] },
  });
  expect(searchStats.response.status).toBe(200);
  expect(searchStats.json).toEqual({
    ok: true,
    total: 3,
    stats: { category: [{ value: "top", count: 3 }] },
    priceBuckets: [],
  });
});

test("search product detail scopes liked lookup to the requested product URL", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listLikedItemUrlsImpl: async () => {
        throw new Error("liked_urls_should_not_be_loaded");
      },
      listLikedItemUrlsForUrlsImpl: async (payload) => {
        calls.push(payload);
        return ["https://example.com/1"];
      },
      getProductsByUrlsInOrderImpl: async () => [
        { url: "https://example.com/1" },
      ],
    },
  });

  const productDetail = await requestJson(
    baseUrl,
    "/search/product?url=https%3A%2F%2Fexample.com%2F1",
    {
      cookie: AUTH_COOKIE,
    },
  );

  expect(productDetail.response.status).toBe(200);
  expect(productDetail.json).toEqual({
    ok: true,
    item: { url: "https://example.com/1", isLiked: true },
  });
  expect(calls).toEqual([
    {
      email: "person@example.com",
      itemUrls: ["https://example.com/1"],
    },
  ]);
});

test("search run maps invalid payload failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const failingSearchServer = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async () => {
        const error = new Error("invalid_payload");
        (error as ErrorWithCode).code = "invalid_payload";
        throw error;
      },
    },
  });

  const invalidSearch = await requestJson(
    failingSearchServer.baseUrl,
    "/search/run",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { query: "coat" },
    },
  );
  expect(invalidSearch.response.status).toBe(400);
  expect(invalidSearch.json).toEqual({ error: "invalid_payload" });
});

test("search run preserves SQL liked state without loading all liked URLs", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listLikedItemUrlsImpl: async () => {
        throw new Error("liked_urls_should_not_be_loaded");
      },
      runSavedSearchImpl: async () => ({
        items: [{ id: "1", url: "https://example.com/1", isLiked: true }],
        total: 1,
        savedSearch: { query: "coat" },
      }),
    },
  });

  const searchRun = await requestJson(baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" },
  });

  expect(searchRun.response.status).toBe(200);
  expect(searchRun.json).toEqual({
    ok: true,
    items: [{ id: "1", url: "https://example.com/1", isLiked: true }],
    total: 1,
    savedSearch: { query: "coat" },
  });
});

test("search routes forward liked-only payloads to search and stats handlers", async (t) => {
  let searchPayload: Record<string, unknown> | null = null;
  let statsPayload: Record<string, unknown> | null = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async (_email, payload) => {
        searchPayload = payload;
        return { items: [], total: 0 };
      },
      getSearchStatsImpl: async (_email, payload) => {
        statsPayload = payload;
        return { total: 0, stats: {}, priceBuckets: [] };
      },
    },
  });

  const searchRun = await requestJson(baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { likedOnly: true },
  });
  expect(searchRun.response.status).toBe(200);
  expect(searchPayload?.likedOnly).toBe(true);

  const searchStats = await requestJson(baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { likedOnly: true },
  });
  expect(searchStats.response.status).toBe(200);
  expect(statsPayload?.likedOnly).toBe(true);
});

test("search product detail rejects missing or unsafe URLs", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const missingUrl = await requestJson(baseUrl, "/search/product", {
    cookie: AUTH_COOKIE,
  });
  expect(missingUrl.response.status).toBe(400);
  expect(missingUrl.json).toEqual({ error: "invalid_payload" });

  const unsafeUrl = await requestJson(
    baseUrl,
    "/search/product?url=javascript%3Aalert(1)",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(unsafeUrl.response.status).toBe(400);
  expect(unsafeUrl.json).toEqual({ error: "invalid_payload" });
});

test("search product detail maps store failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const failingServer = await startTestServer(t, {
    overrides: {
      getProductsByUrlsInOrderImpl: async () => {
        throw new Error("product_store_down");
      },
    },
  });

  const productFailure = await requestJson(
    failingServer.baseUrl,
    "/search/product?url=https%3A%2F%2Fexample.com%2F1",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(productFailure.response.status).toBe(503);
  expect(productFailure.json).toEqual({ error: "service_unavailable" });
});

test("search routes map options, saved search, run, and stats failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const failingOptionsServer = await startTestServer(t, {
    overrides: {
      getSearchOptionsImpl: async () => {
        throw new Error("options_store_down");
      },
    },
  });
  const optionsFailure = await requestJson(
    failingOptionsServer.baseUrl,
    "/search/options",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(optionsFailure.response.status).toBe(503);
  expect(optionsFailure.json).toEqual({ error: "service_unavailable" });

  const failingSavedServer = await startTestServer(t, {
    overrides: {
      getSavedSearchImpl: async () => {
        throw new Error("search_store_down");
      },
    },
  });
  const savedFailure = await requestJson(
    failingSavedServer.baseUrl,
    "/search/me",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(savedFailure.response.status).toBe(503);
  expect(savedFailure.json).toEqual({ error: "service_unavailable" });

  const failingRunServer = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async () => {
        throw new Error("search_provider_down");
      },
    },
  });
  const runFailure = await requestJson(
    failingRunServer.baseUrl,
    "/search/run",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { query: "coat" },
    },
  );
  expect(runFailure.response.status).toBe(503);
  expect(runFailure.json).toEqual({ error: "service_unavailable" });

  const failingStatsServer = await startTestServer(t, {
    overrides: {
      getSearchStatsImpl: async () => {
        const error = new Error("invalid_payload");
        (error as ErrorWithCode).code = "invalid_payload";
        throw error;
      },
    },
  });
  const invalidStats = await requestJson(
    failingStatsServer.baseUrl,
    "/search/stats",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { query: "coat" },
    },
  );
  expect(invalidStats.response.status).toBe(400);
  expect(invalidStats.json).toEqual({ error: "invalid_payload" });

  const unavailableStatsServer = await startTestServer(t, {
    overrides: {
      getSearchStatsImpl: async () => {
        throw new Error("stats_provider_down");
      },
    },
  });
  const statsFailure = await requestJson(
    unavailableStatsServer.baseUrl,
    "/search/stats",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { query: "coat" },
    },
  );
  expect(statsFailure.response.status).toBe(503);
  expect(statsFailure.json).toEqual({ error: "service_unavailable" });
});
