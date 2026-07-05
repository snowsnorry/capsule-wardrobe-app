import { expect, test, vi } from "vitest";
import { runPersistedPartialRegenerationJobForService } from "./regenerateSelectedServiceJobs.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildStoredOutfitSet,
  buildStoredWardrobePayload,
  buildWardrobeGenerationResult,
} from "../test/domainFixtures.js";

function createCapsule() {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      data: {
        wardrobe: buildStoredWardrobePayload({
          items: [
            {
              id: "top-1",
              url: "https://example.com/top-1",
              category: "top",
            },
            {
              id: "bottom-1",
              url: "https://example.com/bottom-1",
              category: "bottom",
            },
            {
              id: "bag-1",
              url: "https://example.com/bag-1",
              category: "bag",
            },
          ],
          outfitSets: [
            buildStoredOutfitSet({
              itemIds: ["top-1", "bottom-1", "bag-1"],
            }),
          ],
          rawSelectionText: "previous",
        }),
        rejectedUrls: ["https://example.com/rejected"],
      },
    }),
  });
}

function createDeps(overrides = {}) {
  return {
    getProfileImpl: vi.fn(async () => buildNormalizedProfileRecord()),
    getCapsuleImpl: vi.fn(async () => createCapsule()),
    updateCapsuleSnapshotImpl: vi.fn(async (_email, _capsuleId, snapshot) =>
      buildNormalizedCapsuleRecord({ draft: snapshot }),
    ),
    regenerateCapsuleWardrobeImpl: vi.fn(async () =>
      buildWardrobeGenerationResult({
        items: [
          {
            id: "top-2",
            url: "https://example.com/top-2",
            category: "top",
          },
        ],
        outfitSets: [
          buildStoredOutfitSet({
            itemIds: ["top-2", "bottom-1", "bag-1"],
          }),
        ],
        rawSelectionText: "next",
      }),
    ),
    buildCapsuleEventSnapshotImpl: vi.fn((payload) => payload),
    publishSnapshotImpl: vi.fn(),
    randomUuidImpl: vi.fn(() => "regen-req-1"),
    nowMsImpl: vi.fn(() => 1_000),
    setTimeoutImpl: vi.fn(),
    jobs: new Map(),
    ...overrides,
  };
}

test("persisted selected regeneration updates durable snapshots and passes abort signals", async () => {
  const signal = new AbortController().signal;
  const progressUpdates = [];
  const deps = createDeps();

  await expect(
    runPersistedPartialRegenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
      itemUrls: ["https://example.com/top-1"],
      signal,
      updateProgress: async (update) => {
        progressUpdates.push(update);
      },
    }),
  ).resolves.toEqual({
    capsuleId: "capsule-1",
    itemUrls: ["https://example.com/top-1"],
  });

  expect(deps.regenerateCapsuleWardrobeImpl).toHaveBeenCalledWith(
    expect.any(Object),
    [expect.objectContaining({ url: "https://example.com/top-1" })],
    expect.objectContaining({ capsuleRequestId: "regen-req-1" }),
    { signal },
  );
  expect(progressUpdates).toEqual([
    {
      phase: "regenerate",
      current: 0,
      label: "Regenerating selected items",
    },
  ]);
  expect(deps.updateCapsuleSnapshotImpl).toHaveBeenCalledTimes(2);
  expect(deps.updateCapsuleSnapshotImpl.mock.calls[0][2].data).toMatchObject({
    rejectedUrls: ["https://example.com/rejected", "https://example.com/top-1"],
  });
  expect(
    deps.updateCapsuleSnapshotImpl.mock.calls[1][2].data.wardrobe,
  ).toMatchObject({
    rawSelectionText: "next",
  });
  expect(deps.publishSnapshotImpl).toHaveBeenCalledTimes(2);
});

test("persisted selected regeneration rejects invalid requests before domain writes", async () => {
  const deps = createDeps();

  await expect(
    runPersistedPartialRegenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
      itemUrls: [],
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });

  expect(deps.updateCapsuleSnapshotImpl).not.toHaveBeenCalled();
  expect(deps.regenerateCapsuleWardrobeImpl).not.toHaveBeenCalled();
});

test("persisted selected regeneration rejects selected anchor items before domain writes", async () => {
  const deps = createDeps({
    getCapsuleImpl: vi.fn(async () =>
      buildNormalizedCapsuleRecord({
        draft: buildCapsuleSnapshot({
          filters: {
            anchorItemRefs: [
              {
                source: "from_catalog",
                url: "https://example.com/top-1",
              },
            ],
          },
          data: {
            wardrobe: buildStoredWardrobePayload({
              items: [
                {
                  id: "top-1",
                  url: "https://example.com/top-1",
                  source: "from_catalog",
                },
              ],
            }),
          },
        }),
      }),
    ),
  });

  await expect(
    runPersistedPartialRegenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
      itemUrls: ["https://example.com/top-1"],
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });

  expect(deps.updateCapsuleSnapshotImpl).not.toHaveBeenCalled();
  expect(deps.regenerateCapsuleWardrobeImpl).not.toHaveBeenCalled();
});

test("persisted selected regeneration does not complete final domain write after abort", async () => {
  const controller = new AbortController();
  const deps = createDeps({
    regenerateCapsuleWardrobeImpl: vi.fn(async () => {
      controller.abort();
      return buildWardrobeGenerationResult({
        items: [
          {
            id: "top-2",
            url: "https://example.com/top-2",
            category: "top",
          },
        ],
      });
    }),
  });

  await expect(
    runPersistedPartialRegenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
      itemUrls: ["https://example.com/top-1"],
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "job_aborted" });

  expect(deps.updateCapsuleSnapshotImpl).toHaveBeenCalledTimes(1);
  expect(deps.publishSnapshotImpl).toHaveBeenCalledTimes(2);
});
