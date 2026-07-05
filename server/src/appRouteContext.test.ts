import { expect, test, vi } from "vitest";
import { createAppRouteContext } from "./appRouteContext.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildStoredOutfitSet,
  buildStoredWardrobePayload,
} from "./test/domainFixtures.js";

test("route context derives active capsule and outfit image state from persisted jobs", async () => {
  const capsule = buildNormalizedCapsuleRecord({
    id: "capsule-1",
    draft: buildCapsuleSnapshot({
      data: {
        wardrobe: buildStoredWardrobePayload({
          items: [
            { id: "top-1", url: "https://example.com/top-1" },
            { id: "bottom-1", url: "https://example.com/bottom-1" },
            { id: "bag-1", url: "https://example.com/bag-1" },
          ],
          outfitSets: [
            buildStoredOutfitSet({
              itemIds: ["top-1", "bottom-1", "bag-1"],
            }),
          ],
        }),
      },
    }),
  });
  const listActiveJobSnapshotsForEntityImpl = vi.fn(async ({ kinds }) => {
    if (kinds?.includes("capsuleRegenerateSelected")) {
      return [
        {
          id: "job-regenerate-selected",
          status: "queued",
          phase: "queued",
          payload: { itemUrls: ["https://example.com/top-1"] },
        },
      ];
    }
    if (kinds?.includes("outfitImageGenerate")) {
      return [{ id: "job-outfit-image", status: "running" }];
    }
    return [];
  });
  const listActiveJobsForEntityImpl = vi.fn(async () => [
    { id: "job-set-image", payload: { setIndex: "2" } },
    { id: "job-set-image-invalid", payload: { setIndex: "bad" } },
  ]);

  const context = createAppRouteContext({
    nodeEnv: "test",
    clientOrigin: "http://localhost:5173",
    getSessionImpl: vi.fn(),
    getCapsuleImpl: vi.fn(),
    listLikedItemUrlsImpl: vi.fn(async () => []),
    streamCapsuleEventsImpl: vi.fn(),
    updateCapsuleSnapshotImpl: vi.fn(),
    listActiveJobSnapshotsForEntityImpl,
    listActiveJobsForEntityImpl,
  });

  const snapshot = await context.getCapsuleEventSnapshot(
    "person@example.com",
    capsule,
  );
  const outfitImageJob = await context.getOutfitImageJobImpl(
    "person@example.com",
    "outfit-1",
  );

  expect(snapshot).toMatchObject({
    status: "pending",
    pendingRegenerationUrls: ["https://example.com/top-1"],
    pendingImageSetIndexes: [2],
  });
  expect(outfitImageJob).toMatchObject({
    id: "job-outfit-image",
    status: "running",
  });
  expect(listActiveJobSnapshotsForEntityImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      entityType: "capsule",
      entityId: "capsule-1",
      kinds: ["capsuleGenerate"],
    }),
  );
  expect(listActiveJobsForEntityImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    entityType: "capsule",
    entityId: "capsule-1",
    kinds: ["outfitSetImageGenerate"],
  });
});
