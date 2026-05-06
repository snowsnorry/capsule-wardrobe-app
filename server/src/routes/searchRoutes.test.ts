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
