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
