import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

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
            text: "",
          },
          data: {
            wardrobe: {
              items: [{ id: "top-1", category: "top" }],
              outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
            },
            rejectedUrls: [],
          },
        },
        saved: null,
        status: "new",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      }),
      getOutfitSetImageJobImpl: () => ({
        status: "pending",
        pendingSetIndexes: [0],
      }),
      streamCapsuleEventsImpl: async (_req, res, { snapshot }) => {
        streamedSnapshot = snapshot;
        res.json({ ok: true, snapshot });
      },
    },
  });

  const response = await requestJson(baseUrl, "/capsules/capsule-1/events", {
    cookie: AUTH_COOKIE,
  });

  expect(response.response.status).toBe(200);
  expect(streamedSnapshot?.pendingImageSetIndexes).toEqual([0]);
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
          expiresAt,
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
          saved: {
            filters: {},
            data: {
              wardrobe: { items: [{ url: "https://example.com/1" }] },
              rejectedUrls: [],
            },
          },
          status: "saved",
        };
      },
    },
  });

  const missingAuth = await requestJson(baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    csrfToken: CSRF_TOKEN,
  });
  expect(missingAuth.response.status).toBe(401);

  const missingCsrf = await requestJson(baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
  });
  expect(missingCsrf.response.status).toBe(403);

  const created = await requestJson(baseUrl, "/capsules/capsule-1/share", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(created.response.status).toBe(201);
  expect(created.json).toEqual({
    ok: true,
    id: "share-1",
    url: `${TEST_CLIENT_ORIGIN}/share/share-1`,
    expiresAt,
  });

  const metadata = await requestJson(baseUrl, "/shared-capsules/share-1");
  expect(metadata.response.status).toBe(200);
  expect(metadata.json).toEqual({
    ok: true,
    id: "share-1",
    name: "Spring edit",
    expiresAt,
  });

  const imported = await requestJson(
    baseUrl,
    "/shared-capsules/share-1/import",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(imported.response.status).toBe(201);
  expect(imported.json.capsuleId).toBe("capsule-imported");
  expect(imported.json.name).toBe("Spring edit (2)");

  const expired = await requestJson(baseUrl, "/shared-capsules/expired-share");
  expect(expired.response.status).toBe(404);
  expect(expired.json).toEqual({ error: "shared_capsule_unavailable" });

  expect(calls).toEqual([
    {
      type: "create",
      email: "person@example.com",
      capsuleId: "capsule-1",
      clientOrigin: TEST_CLIENT_ORIGIN,
    },
    { type: "get", id: "share-1" },
    { type: "import", email: "person@example.com", id: "share-1" },
    { type: "get", id: "expired-share" },
  ]);
});

test("capsule read routes expose recent, search, and lookup fallbacks", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      countCapsulesImpl: async () => 12,
      listRecentCapsulesImpl: async (_email, limit, offset) => {
        calls.push({ type: "recent", limit, offset });
        return [{ id: "capsule-1", name: "Spring edit", status: "saved" }];
      },
      searchCapsulesImpl: async (_email, query, limit) => {
        calls.push({ type: "search", query, limit });
        return [{ id: "capsule-2", name: "Office edit", status: "saved" }];
      },
    },
  });

  const recent = await requestJson(baseUrl, "/capsules/recent", {
    cookie: AUTH_COOKIE,
  });
  expect(recent.response.status).toBe(200);
  expect(recent.json.capsules[0].id).toBe("capsule-1");
  expect(recent.json.pagination).toEqual({
    limit: 10,
    offset: 0,
    total: 12,
    hasMore: true,
  });

  const nextRecent = await requestJson(
    baseUrl,
    "/capsules/recent?limit=999&offset=10",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(nextRecent.response.status).toBe(200);
  expect(nextRecent.json.pagination).toEqual({
    limit: 50,
    offset: 10,
    total: 12,
    hasMore: false,
  });

  const emptySearch = await requestJson(baseUrl, "/capsules/search", {
    cookie: AUTH_COOKIE,
  });
  expect(emptySearch.response.status).toBe(200);
  expect(emptySearch.json.capsules[0].id).toBe("capsule-1");

  const querySearch = await requestJson(baseUrl, "/capsules/search?q=office", {
    cookie: AUTH_COOKIE,
  });
  expect(querySearch.response.status).toBe(200);
  expect(querySearch.json.capsules[0].id).toBe("capsule-2");

  const capsule = await requestJson(baseUrl, "/capsules/capsule-1", {
    cookie: AUTH_COOKIE,
  });
  expect(capsule.response.status).toBe(200);
  expect((capsule.json.capsule as { id?: string }).id).toBe("capsule-1");
  const capsuleBody = capsule.json as {
    capsule: {
      effective: {
        data: { wardrobe: { items: { isSavedToWardrobe?: boolean }[] } };
      };
    };
  };
  expect(
    capsuleBody.capsule.effective.data.wardrobe.items[0].isSavedToWardrobe,
  ).toBe(true);

  expect(calls).toEqual([
    { type: "recent", limit: 10, offset: 0 },
    { type: "recent", limit: 50, offset: 10 },
    { type: "recent", limit: 25, offset: undefined },
    { type: "search", query: "office", limit: 25 },
  ]);
});

test("capsule read and share routes map missing records and service failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const failingRecentServer = await startTestServer(t, {
    overrides: {
      listRecentCapsulesImpl: async () => {
        throw new Error("capsule_store_down");
      },
    },
  });
  const recentFailure = await requestJson(
    failingRecentServer.baseUrl,
    "/capsules/recent",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(recentFailure.response.status).toBe(503);
  expect(recentFailure.json).toEqual({ error: "service_unavailable" });

  const failingSearchServer = await startTestServer(t, {
    overrides: {
      searchCapsulesImpl: async () => {
        throw new Error("capsule_search_down");
      },
    },
  });
  const searchFailure = await requestJson(
    failingSearchServer.baseUrl,
    "/capsules/search?q=office",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(searchFailure.response.status).toBe(503);
  expect(searchFailure.json).toEqual({ error: "service_unavailable" });

  const missingCapsuleServer = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => null,
    },
  });
  const missingCapsule = await requestJson(
    missingCapsuleServer.baseUrl,
    "/capsules/missing",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(missingCapsule.response.status).toBe(404);
  expect(missingCapsule.json).toEqual({ error: "not_found" });

  const unavailableShareServer = await startTestServer(t, {
    overrides: {
      createCapsuleShareImpl: async () => null,
      getSharedCapsuleImpl: async () => {
        throw new Error("share_store_down");
      },
      importSharedCapsuleImpl: async () => null,
    },
  });
  const missingShare = await requestJson(
    unavailableShareServer.baseUrl,
    "/capsules/capsule-1/share",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(missingShare.response.status).toBe(404);
  expect(missingShare.json).toEqual({ error: "not_found" });

  const sharedFailure = await requestJson(
    unavailableShareServer.baseUrl,
    "/shared-capsules/share-1",
  );
  expect(sharedFailure.response.status).toBe(503);
  expect(sharedFailure.json).toEqual({ error: "service_unavailable" });

  const missingImport = await requestJson(
    unavailableShareServer.baseUrl,
    "/shared-capsules/share-1/import",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(missingImport.response.status).toBe(404);
  expect(missingImport.json).toEqual({ error: "shared_capsule_unavailable" });

  const notShareableServer = await startTestServer(t, {
    overrides: {
      createCapsuleShareImpl: async () => {
        const error = new Error("capsule_not_shareable");
        throw error;
      },
      importSharedCapsuleImpl: async () => {
        const error = new Error("capsule_not_shareable");
        throw error;
      },
    },
  });
  const notShareable = await requestJson(
    notShareableServer.baseUrl,
    "/capsules/capsule-1/share",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(notShareable.response.status).toBe(400);
  expect(notShareable.json).toEqual({ error: "capsule_not_shareable" });

  const notImportable = await requestJson(
    notShareableServer.baseUrl,
    "/shared-capsules/share-1/import",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(notImportable.response.status).toBe(400);
  expect(notImportable.json).toEqual({ error: "capsule_not_shareable" });

  const personalItemsServer = await startTestServer(t, {
    overrides: {
      createCapsuleShareImpl: async () => {
        const error = new Error("capsule_contains_personal_items");
        throw error;
      },
      importSharedCapsuleImpl: async () => {
        const error = new Error("capsule_contains_personal_items");
        throw error;
      },
    },
  });
  const personalItemsShare = await requestJson(
    personalItemsServer.baseUrl,
    "/capsules/capsule-1/share",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(personalItemsShare.response.status).toBe(400);
  expect(personalItemsShare.json).toEqual({
    error: "capsule_contains_personal_items",
  });

  const personalItemsImport = await requestJson(
    personalItemsServer.baseUrl,
    "/shared-capsules/share-1/import",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(personalItemsImport.response.status).toBe(400);
  expect(personalItemsImport.json).toEqual({
    error: "capsule_contains_personal_items",
  });
});
