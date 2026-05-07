import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_COOKIE, CSRF_TOKEN, TEST_CLIENT_ORIGIN, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("capsule events initial snapshot includes pending outfit set image indexes", async (t) => {
  let streamedSnapshot = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "<New capsule>",
        draft: {
          filters: {
            formalityLevel: "casual",
            style: "minimalistic",
            occasions: ["office"],
            season: ["spring"],
            audience: "woman",
            color: null,
            pattern: "solid",
            text: ""
          },
          data: {
            wardrobe: {
              items: [{ id: "top-1", category: "top" }],
              outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }]
            },
            rejectedUrls: []
          }
        },
        saved: null,
        status: "new",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }),
      getOutfitSetImageJobImpl: () => ({
        status: "pending",
        pendingSetIndexes: [0]
      }),
      streamCapsuleEventsImpl: async (_req, res, { snapshot }) => {
        streamedSnapshot = snapshot;
        res.json({ ok: true, snapshot });
      }
    }
  });

  const response = await requestJson(baseUrl, "/capsules/capsule-1/events", {
    cookie: AUTH_COOKIE
  });

  assert.equal(response.response.status, 200);
  assert.deepEqual(streamedSnapshot?.pendingImageSetIndexes, [0]);
});

test("share routes create, read, import, and enforce auth boundaries", async (t) => {
  const calls: unknown[] = [];
  const expiresAt = new Date(60_000).toISOString();
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      createCapsuleShareImpl: async (email, capsuleId, clientOrigin) => {
        calls.push({ type: "create", email, capsuleId, clientOrigin });
        return {
          id: "share-1",
          url: `${clientOrigin}/share/share-1`,
          expiresAt
        };
      },
      getSharedCapsuleImpl: async (id) => {
        calls.push({ type: "get", id });
        return id === "share-1" ? { id, name: "Spring edit", expiresAt } : null;
      },
      importSharedCapsuleImpl: async (email, id) => {
        calls.push({ type: "import", email, id });
        return {
          id: "capsule-imported",
          name: "Spring edit (2)",
          draft: null,
          saved: { filters: {}, data: { wardrobe: { items: [{ url: "https://example.com/1" }] }, rejectedUrls: [] } },
          status: "saved"
        };
      }
    }
  });

  const missingAuth = await requestJson(baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(missingAuth.response.status, 401);

  const missingCsrf = await requestJson(baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE
  });
  assert.equal(missingCsrf.response.status, 403);

  const created = await requestJson(baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.json, {
    ok: true,
    id: "share-1",
    url: `${TEST_CLIENT_ORIGIN}/share/share-1`,
    expiresAt
  });

  const metadata = await requestJson(baseUrl, "/shared-capsules/share-1");
  assert.equal(metadata.response.status, 200);
  assert.deepEqual(metadata.json, {
    ok: true,
    id: "share-1",
    name: "Spring edit",
    expiresAt
  });

  const imported = await requestJson(baseUrl, "/shared-capsules/share-1/import", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(imported.response.status, 201);
  assert.equal(imported.json.capsuleId, "capsule-imported");
  assert.equal(imported.json.name, "Spring edit (2)");

  const expired = await requestJson(baseUrl, "/shared-capsules/expired-share");
  assert.equal(expired.response.status, 404);
  assert.deepEqual(expired.json, { error: "shared_capsule_unavailable" });

  assert.deepEqual(calls, [
    { type: "create", email: "person@example.com", capsuleId: "capsule-1", clientOrigin: TEST_CLIENT_ORIGIN },
    { type: "get", id: "share-1" },
    { type: "import", email: "person@example.com", id: "share-1" },
    { type: "get", id: "expired-share" }
  ]);
});

test("capsule read routes expose bootstrap, recent, search, and lookup fallbacks", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listRecentCapsulesImpl: async (_email, limit) => {
        calls.push({ type: "recent", limit });
        return [{ id: "capsule-1", name: "Spring edit", status: "saved" }];
      },
      searchCapsulesImpl: async (_email, query, limit) => {
        calls.push({ type: "search", query, limit });
        return [{ id: "capsule-2", name: "Office edit", status: "saved" }];
      },
      setActiveCapsuleIdImpl: async (_email, capsuleId) => {
        calls.push({ type: "set-active", capsuleId });
        return { activeCapsuleId: capsuleId };
      }
    }
  });

  const bootstrap = await requestJson(baseUrl, "/capsules/bootstrap", {
    cookie: AUTH_COOKIE
  });
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.json.ok, true);
  assert.equal((bootstrap.json.activeCapsule as { id?: string }).id, "capsule-1");

  const recent = await requestJson(baseUrl, "/capsules/recent", {
    cookie: AUTH_COOKIE
  });
  assert.equal(recent.response.status, 200);
  assert.equal(recent.json.capsules[0].id, "capsule-1");

  const emptySearch = await requestJson(baseUrl, "/capsules/search", {
    cookie: AUTH_COOKIE
  });
  assert.equal(emptySearch.response.status, 200);
  assert.equal(emptySearch.json.capsules[0].id, "capsule-1");

  const querySearch = await requestJson(baseUrl, "/capsules/search?q=office", {
    cookie: AUTH_COOKIE
  });
  assert.equal(querySearch.response.status, 200);
  assert.equal(querySearch.json.capsules[0].id, "capsule-2");

  const capsule = await requestJson(baseUrl, "/capsules/capsule-1", {
    cookie: AUTH_COOKIE
  });
  assert.equal(capsule.response.status, 200);
  assert.equal((capsule.json.capsule as { id?: string }).id, "capsule-1");

  assert.deepEqual(calls, [
    { type: "recent", limit: 10 },
    { type: "recent", limit: 10 },
    { type: "recent", limit: 25 },
    { type: "search", query: "office", limit: 25 },
    { type: "set-active", capsuleId: "capsule-1" }
  ]);
});

test("capsule read and share routes map missing records and service failures", async (t) => {
  t.mock.method(console, "error", () => {});

  const failingBootstrapServer = await startTestServer(t, {
    overrides: {
      resolveActiveCapsuleImpl: async () => {
        throw new Error("capsule_store_down");
      }
    }
  });
  const bootstrapFailure = await requestJson(failingBootstrapServer.baseUrl, "/capsules/bootstrap", {
    cookie: AUTH_COOKIE
  });
  assert.equal(bootstrapFailure.response.status, 503);
  assert.deepEqual(bootstrapFailure.json, { error: "service_unavailable" });

  const failingRecentServer = await startTestServer(t, {
    overrides: {
      listRecentCapsulesImpl: async () => {
        throw new Error("capsule_store_down");
      }
    }
  });
  const recentFailure = await requestJson(failingRecentServer.baseUrl, "/capsules/recent", {
    cookie: AUTH_COOKIE
  });
  assert.equal(recentFailure.response.status, 503);
  assert.deepEqual(recentFailure.json, { error: "service_unavailable" });

  const failingSearchServer = await startTestServer(t, {
    overrides: {
      searchCapsulesImpl: async () => {
        throw new Error("capsule_search_down");
      }
    }
  });
  const searchFailure = await requestJson(failingSearchServer.baseUrl, "/capsules/search?q=office", {
    cookie: AUTH_COOKIE
  });
  assert.equal(searchFailure.response.status, 503);
  assert.deepEqual(searchFailure.json, { error: "service_unavailable" });

  const missingCapsuleServer = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => null
    }
  });
  const missingCapsule = await requestJson(missingCapsuleServer.baseUrl, "/capsules/missing", {
    cookie: AUTH_COOKIE
  });
  assert.equal(missingCapsule.response.status, 404);
  assert.deepEqual(missingCapsule.json, { error: "not_found" });

  const unavailableShareServer = await startTestServer(t, {
    overrides: {
      createCapsuleShareImpl: async () => null,
      getSharedCapsuleImpl: async () => {
        throw new Error("share_store_down");
      },
      importSharedCapsuleImpl: async () => null
    }
  });
  const missingShare = await requestJson(unavailableShareServer.baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(missingShare.response.status, 404);
  assert.deepEqual(missingShare.json, { error: "not_found" });

  const sharedFailure = await requestJson(unavailableShareServer.baseUrl, "/shared-capsules/share-1");
  assert.equal(sharedFailure.response.status, 503);
  assert.deepEqual(sharedFailure.json, { error: "service_unavailable" });

  const missingImport = await requestJson(unavailableShareServer.baseUrl, "/shared-capsules/share-1/import", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(missingImport.response.status, 404);
  assert.deepEqual(missingImport.json, { error: "shared_capsule_unavailable" });

  const notShareableServer = await startTestServer(t, {
    overrides: {
      createCapsuleShareImpl: async () => {
        const error = new Error("capsule_not_shareable");
        throw error;
      },
      importSharedCapsuleImpl: async () => {
        const error = new Error("capsule_not_shareable");
        throw error;
      }
    }
  });
  const notShareable = await requestJson(notShareableServer.baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(notShareable.response.status, 400);
  assert.deepEqual(notShareable.json, { error: "capsule_not_shareable" });

  const notImportable = await requestJson(notShareableServer.baseUrl, "/shared-capsules/share-1/import", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(notImportable.response.status, 400);
  assert.deepEqual(notImportable.json, { error: "capsule_not_shareable" });
});
