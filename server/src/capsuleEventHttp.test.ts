import { test, expect, vi } from "vitest";
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
    },
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
          outfitSets: [],
        },
        rejectedUrls: [],
        regeneration: null,
      },
    },
    saved: null,
    ...overrides,
  };
}

function createHandlers(overrides = {}) {
  return createCapsuleEventHandlers({
    getCapsuleImpl: async () => createCapsule(),
    getOutfitSetImageJobImpl: () => null,
    getPartialRegenerationJobImpl: () => null,
    getWardrobeJobImpl: () => null,
    streamCapsuleEventsImpl: async (_req, res, { snapshot }) =>
      res.json({ snapshot }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, snapshot) =>
      createCapsule({ draft: snapshot }),
    ...overrides,
  });
}

test("streamCapsuleEventsHandler validates capsule id and missing capsules", async () => {
  const handlers = createHandlers({
    getCapsuleImpl: async () => null,
  });

  const missingId = createResponse();
  await handlers.streamCapsuleEventsHandler(
    { params: {}, user: { email: "person@example.com" } },
    missingId,
  );
  expect(missingId.statusCode).toBe(400);
  expect(missingId.body).toEqual({ error: "invalid_payload" });

  const missingCapsule = createResponse();
  await handlers.streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    missingCapsule,
  );
  expect(missingCapsule.statusCode).toBe(404);
  expect(missingCapsule.body).toEqual({ error: "not_found" });
});

test("getCapsuleEventSnapshot clears stale regeneration markers", async () => {
  const updates = [];
  const handlers = createHandlers({
    getWardrobeJobImpl: () => ({ status: "failed" }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, snapshot) => {
      updates.push(snapshot);
      return createCapsule({ draft: snapshot });
    },
  });

  const snapshot = await handlers.getCapsuleEventSnapshot(
    "person@example.com",
    createCapsule({
      draft: {
        filters: {},
        data: {
          wardrobe: {
            items: [{ id: "top-1", category: "top" }],
            outfitSets: [],
          },
          rejectedUrls: [],
          regeneration: {
            status: "pending",
            kind: "full",
            startedAt: new Date(0).toISOString(),
            requestId: "request-1",
          },
        },
      },
    }),
  );

  expect(updates.length).toBe(1);
  expect(snapshot.status).toBe("failed");
});

test("streamCapsuleEventsHandler streams snapshots and maps unhandled errors", async () => {
  const streamed = createResponse();
  await createHandlers().streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    streamed,
  );
  expect(streamed.statusCode).toBe(200);
  expect(streamed.body).toBeTruthy();

  const errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args);
  });

  const failed = createResponse();
  await createHandlers({
    streamCapsuleEventsImpl: async () => {
      throw new Error("stream failed");
    },
  }).streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    failed,
  );
  expect(failed.statusCode).toBe(503);
  expect(failed.body).toEqual({ error: "service_unavailable" });

  const headersAlreadySent = createResponse();
  headersAlreadySent.headersSent = true;
  await createHandlers({
    streamCapsuleEventsImpl: async () => {
      throw new Error("stream failed");
    },
  }).streamCapsuleEventsHandler(
    { params: { id: "capsule-1" }, user: { email: "person@example.com" } },
    headersAlreadySent,
  );
  expect(headersAlreadySent.body).toBe(null);
  expect(errors.length).toBe(2);
  expect(errors[0][0]).toBe("[capsules/events]");
  expect(errors[1][0]).toBe("[capsules/events]");
});
