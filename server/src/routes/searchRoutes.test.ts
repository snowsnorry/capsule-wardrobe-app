import test from "node:test";
import assert from "node:assert/strict";
import type { ErrorWithCode } from "../ai/types.js";
import { AUTH_COOKIE, CSRF_TOKEN, TEST_CLIENT_ORIGIN, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("search routes expose options, saved search, run, and stats", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const searchOptions = await requestJson(baseUrl, "/search/options", {
    cookie: AUTH_COOKIE
  });
  assert.equal(searchOptions.response.status, 200);
  assert.equal(searchOptions.json.ok, true);
  assert.deepEqual(searchOptions.json.audience, ["woman", "man", "all"]);

  const savedSearch = await requestJson(baseUrl, "/search/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(savedSearch.response.status, 200);
  assert.deepEqual(savedSearch.json, {
    ok: true,
    search: { query: "coat", page: 1 }
  });

  const searchRun = await requestJson(baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(searchRun.response.status, 200);
  assert.equal(searchRun.json.ok, true);

  const searchStats = await requestJson(baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { category: ["top"] }
  });
  assert.equal(searchStats.response.status, 200);
  assert.deepEqual(searchStats.json, {
    ok: true,
    total: 3,
    stats: { category: [{ value: "top", count: 3 }] },
    priceBuckets: []
  });
});

test("search run maps invalid payload failures", async (t) => {
  t.mock.method(console, "error", () => {});

  const failingSearchServer = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async () => {
        const error = new Error("invalid_payload");
        (error as ErrorWithCode).code = "invalid_payload";
        throw error;
      }
    }
  });

  const invalidSearch = await requestJson(failingSearchServer.baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(invalidSearch.response.status, 400);
  assert.deepEqual(invalidSearch.json, { error: "invalid_payload" });
});

test("search routes map options, saved search, run, and stats failures", async (t) => {
  t.mock.method(console, "error", () => {});

  const failingOptionsServer = await startTestServer(t, {
    overrides: {
      getSearchOptionsImpl: async () => {
        throw new Error("options_store_down");
      }
    }
  });
  const optionsFailure = await requestJson(failingOptionsServer.baseUrl, "/search/options", {
    cookie: AUTH_COOKIE
  });
  assert.equal(optionsFailure.response.status, 503);
  assert.deepEqual(optionsFailure.json, { error: "service_unavailable" });

  const failingSavedServer = await startTestServer(t, {
    overrides: {
      getSavedSearchImpl: async () => {
        throw new Error("search_store_down");
      }
    }
  });
  const savedFailure = await requestJson(failingSavedServer.baseUrl, "/search/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(savedFailure.response.status, 503);
  assert.deepEqual(savedFailure.json, { error: "service_unavailable" });

  const failingRunServer = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async () => {
        throw new Error("search_provider_down");
      }
    }
  });
  const runFailure = await requestJson(failingRunServer.baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(runFailure.response.status, 503);
  assert.deepEqual(runFailure.json, { error: "service_unavailable" });

  const failingStatsServer = await startTestServer(t, {
    overrides: {
      getSearchStatsImpl: async () => {
        const error = new Error("invalid_payload");
        (error as ErrorWithCode).code = "invalid_payload";
        throw error;
      }
    }
  });
  const invalidStats = await requestJson(failingStatsServer.baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(invalidStats.response.status, 400);
  assert.deepEqual(invalidStats.json, { error: "invalid_payload" });

  const unavailableStatsServer = await startTestServer(t, {
    overrides: {
      getSearchStatsImpl: async () => {
        throw new Error("stats_provider_down");
      }
    }
  });
  const statsFailure = await requestJson(unavailableStatsServer.baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(statsFailure.response.status, 503);
  assert.deepEqual(statsFailure.json, { error: "service_unavailable" });
});
