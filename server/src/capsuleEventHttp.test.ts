import { test, expect } from "vitest";
import { createCapsuleEventHandlers } from "./capsuleEventHttp.js";

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
    getOutfitSetImageJobImpl: () => null,
    getPartialRegenerationJobImpl: () => null,
    getWardrobeJobImpl: () => null,
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, snapshot) =>
      createCapsule({ draft: snapshot }),
    ...overrides,
  });
}

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

test.each(["queued", "running"])(
  "getCapsuleEventSnapshot keeps regeneration markers for an active %s job",
  async (status) => {
    const updates = [];
    const handlers = createHandlers({
      getWardrobeJobImpl: () => ({ status }),
      updateCapsuleSnapshotImpl: async (_email, _capsuleId, snapshot) => {
        updates.push(snapshot);
        return createCapsule({ draft: snapshot });
      },
    });
    const capsule = createCapsule({
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
    });

    const snapshot = await handlers.getCapsuleEventSnapshot(
      "person@example.com",
      capsule,
    );

    expect(updates).toEqual([]);
    expect(snapshot.status).toBe("pending");
  },
);
