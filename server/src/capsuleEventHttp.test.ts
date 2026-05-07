import test from "node:test";
import assert from "node:assert/strict";
import { createCapsuleEventHandlers } from "./capsuleEventHttp.js";

function createResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
}

function createCapsule(overrides = {}) {
  return {
    id: "capsule-1",
    draft: {
      filters: {},
      data: {
        wardrobe: {
          items: [{ id: "top-1", category: "top" }],
          outfitSets: []
        },
        rejectedUrls: [],
        regeneration: null
      }
    },
    saved: null,
    ...overrides
  };
}

function createHandlers(overrides = {}) {
  return createCapsuleEventHandlers({
    getCapsuleImpl: async () => createCapsule(),
    getOutfitSetImageJobImpl: () => null,
    getPartialRegenerationJobImpl: () => null,
    getWardrobeJobImpl: () => null,
    streamCapsuleEventsImpl: async (_req, res, { snapshot }) => res.json({ snapshot }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, snapshot) => createCapsule({ draft: snapshot }),
    ...overrides
  });
}

test("streamCapsuleEventsHandler validates capsule id and missing capsules", async () => {
  const handlers = createHandlers({
    getCapsuleImpl: async () => null
  });

  const missingId = createResponse();
  await handlers.streamCapsuleEventsHandler({ params: {}, user: { email: "person@example.com" } }, missingId);
  assert.equal(missingId.statusCode, 400);
  assert.deepEqual(missingId.body, { error: "invalid_payload" });

  const missingCapsule = createResponse();
  await handlers.streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    missingCapsule
  );
  assert.equal(missingCapsule.statusCode, 404);
  assert.deepEqual(missingCapsule.body, { error: "not_found" });
});

test("getCapsuleEventSnapshot clears stale regeneration markers", async () => {
  const updates = [];
  const handlers = createHandlers({
    getWardrobeJobImpl: () => ({ status: "failed" }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, snapshot) => {
      updates.push(snapshot);
      return createCapsule({ draft: snapshot });
    }
  });

  const snapshot = await handlers.getCapsuleEventSnapshot("person@example.com", createCapsule({
    draft: {
      filters: {},
      data: {
        wardrobe: { items: [{ id: "top-1", category: "top" }], outfitSets: [] },
        rejectedUrls: [],
        regeneration: {
          status: "pending",
          kind: "full",
          startedAt: new Date(0).toISOString(),
          requestId: "request-1"
        }
      }
    }
  }));

  assert.equal(updates.length, 1);
  assert.equal(snapshot.status, "failed");
});

test("streamCapsuleEventsHandler streams snapshots and maps unhandled errors", async (t) => {
  const streamed = createResponse();
  await createHandlers().streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    streamed
  );
  assert.equal(streamed.statusCode, 200);
  assert.ok(streamed.body);

  const errors = [];
  t.mock.method(console, "error", (...args) => {
    errors.push(args);
  });

  const failed = createResponse();
  await createHandlers({
    streamCapsuleEventsImpl: async () => {
      throw new Error("stream failed");
    }
  }).streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    failed
  );
  assert.equal(failed.statusCode, 503);
  assert.deepEqual(failed.body, { error: "service_unavailable" });

  const headersAlreadySent = createResponse();
  headersAlreadySent.headersSent = true;
  await createHandlers({
    streamCapsuleEventsImpl: async () => {
      throw new Error("stream failed");
    }
  }).streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    headersAlreadySent
  );
  assert.equal(headersAlreadySent.body, null);
  assert.equal(errors.length, 2);
  assert.equal(errors[0][0], "[capsules/events]");
  assert.equal(errors[1][0], "[capsules/events]");
});
