import { test, expect, vi } from "vitest";
import { runPersistedWardrobeGenerationJobForService } from "./wardrobeJobService.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildWardrobeGenerationResult,
  buildWardrobeUiItem,
} from "../test/domainFixtures.js";

function createCapsuleWithWardrobe(wardrobe = null) {
  return buildNormalizedCapsuleRecord({
    id: "capsule-1",
    draft: buildCapsuleSnapshot({
      data: {
        wardrobe,
        rejectedUrls: [],
        regeneration: null,
      },
    }),
  });
}

function createItem(id: string, category = "top") {
  return buildWardrobeUiItem({
    id,
    category,
    url: undefined,
    name: undefined,
    imageUrl: undefined,
    audience: undefined,
  });
}

function createDeps(overrides = {}) {
  return {
    getProfileImpl: vi.fn(async () =>
      buildNormalizedProfileRecord({ audience: "woman", locale: "en" }),
    ),
    getCapsuleImpl: vi.fn(async () => createCapsuleWithWardrobe(null)),
    renameCapsuleImpl: vi.fn(async (_email, capsuleId, name) =>
      buildNormalizedCapsuleRecord({
        id: capsuleId,
        name,
        draft: createCapsuleWithWardrobe(null).draft,
        saved: null,
        status: "new",
      }),
    ),
    updateCapsuleSnapshotImpl: vi.fn(async (_email, capsuleId, draft) =>
      buildNormalizedCapsuleRecord({
        id: capsuleId,
        draft,
        saved: null,
      }),
    ),
    generateCapsuleWardrobeImpl: vi.fn(async () =>
      buildWardrobeGenerationResult({
        items: [createItem("top-1")],
        selectedItems: [createItem("top-1")],
        promptEmbeddings: [0.1],
      }),
    ),
    shouldGenerateSwimwearImpl: vi.fn(() => false),
    shouldCompleteSelectedSwimwearImpl: vi.fn(() => false),
    generateSwimwearAdditionImpl: vi.fn(async () => ({
      items: [],
      reasoning: null,
      rawSelectionText: null,
    })),
    getPartialRegenerationJobImpl: vi.fn(() => null),
    buildCapsuleEventSnapshotImpl: vi.fn((payload) => payload),
    publishSnapshotImpl: vi.fn(),
    nowMsImpl: vi.fn(() => 1_000),
    randomUuidImpl: vi.fn(() => "capsule-req-1"),
    ...overrides,
  };
}

test("persisted wardrobe generation updates progress, snapshots, and final capsule state", async () => {
  const progressUpdates = [];
  const deps = createDeps({
    generateCapsuleWardrobeImpl: vi.fn(
      async (_profile, _logContext, _options) =>
        buildWardrobeGenerationResult({
          items: [createItem("top-1"), createItem("bottom-1", "bottom")],
          selectedItems: [
            createItem("top-1"),
            createItem("bottom-1", "bottom"),
          ],
          promptEmbeddings: [0.1],
          outfitSets: [{ itemIds: ["top-1", "bottom-1"] }],
          rawSelectionText: "capsule-raw",
        }),
    ),
  });

  await expect(
    runPersistedWardrobeGenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
      updateProgress: async (update) => {
        progressUpdates.push(update);
      },
    }),
  ).resolves.toEqual({ capsuleId: "capsule-1" });

  expect(progressUpdates).toEqual([
    { phase: "capsule", current: 0, label: "Generating capsule" },
  ]);
  expect(deps.generateCapsuleWardrobeImpl).toHaveBeenCalledWith(
    expect.objectContaining({ locale: "en" }),
    expect.objectContaining({ capsuleRequestId: "capsule-req-1" }),
    { signal: null },
  );
  expect(deps.updateCapsuleSnapshotImpl).toHaveBeenCalledTimes(2);
  expect(deps.updateCapsuleSnapshotImpl.mock.calls[1][2].data.wardrobe).toEqual(
    expect.objectContaining({
      rawSelectionText: "capsule-raw",
      outfitSets: [{ itemIds: ["top-1", "bottom-1"] }],
    }),
  );
  expect(deps.publishSnapshotImpl).toHaveBeenCalledTimes(2);
});

test("persisted wardrobe generation completes anchored swimwear when seasonal swimwear generation is disabled", async () => {
  const deps = createDeps({
    generateCapsuleWardrobeImpl: vi.fn(async () =>
      buildWardrobeGenerationResult({
        items: [
          buildWardrobeUiItem({
            id: "W12",
            category: "swimwear",
            url: "wardrobe://12",
            name: "Bikini Bottom",
            imageUrl: undefined,
            audience: "woman",
            swimwearType: "swimwear_bottom",
          }),
        ],
        selectedItems: [
          buildWardrobeUiItem({
            id: "W12",
            category: "swimwear",
            url: "wardrobe://12",
            name: "Bikini Bottom",
            imageUrl: undefined,
            audience: "woman",
            swimwearType: "swimwear_bottom",
          }),
        ],
        promptEmbeddings: [0.1],
      }),
    ),
    shouldGenerateSwimwearImpl: vi.fn(() => false),
    shouldCompleteSelectedSwimwearImpl: vi.fn(() => true),
    generateSwimwearAdditionImpl: vi.fn(async () => ({
      items: [
        buildWardrobeUiItem({
          id: "swim-top-1",
          category: "swimwear",
          url: "https://example.com/swim-top-1",
          name: "Bikini Top",
          imageUrl: undefined,
          audience: "woman",
          swimwearType: "swimwear_top",
        }),
      ],
      reasoning: null,
      rawSelectionText: null,
    })),
  });

  await runPersistedWardrobeGenerationJobForService(deps, {
    email: "person@example.com",
    capsuleId: "capsule-1",
  });

  expect(deps.generateSwimwearAdditionImpl).toHaveBeenCalledOnce();
  expect(
    deps.updateCapsuleSnapshotImpl.mock.calls
      .at(-1)?.[2]
      .data.wardrobe.items.map((item) => item.id),
  ).toEqual(["W12", "swim-top-1"]);
});

test("persisted wardrobe generation renames a new empty capsule from stylist shortCapsuleName", async () => {
  const deps = createDeps({
    getCapsuleImpl: vi.fn(async () =>
      buildNormalizedCapsuleRecord({
        ...createCapsuleWithWardrobe(null),
        name: "<New capsule>",
        status: "new",
      }),
    ),
    generateCapsuleWardrobeImpl: vi.fn(async () =>
      buildWardrobeGenerationResult({
        items: [createItem("top-1")],
        selectedItems: [createItem("top-1")],
        promptEmbeddings: [0.1],
        shortCapsuleName: "City Core",
      }),
    ),
  });

  await runPersistedWardrobeGenerationJobForService(deps, {
    email: "person@example.com",
    capsuleId: "capsule-1",
  });

  expect(deps.renameCapsuleImpl).toHaveBeenCalledWith(
    "person@example.com",
    "capsule-1",
    "City Core",
  );
});

test("persisted wardrobe generation marks job failed when capsule generation returns no usable items", async () => {
  const published = [];
  const deps = createDeps({
    generateCapsuleWardrobeImpl: vi.fn(async () =>
      buildWardrobeGenerationResult(),
    ),
    publishSnapshotImpl: vi.fn((_email, _capsuleId, snapshot) => {
      published.push(snapshot);
    }),
  });

  await expect(
    runPersistedWardrobeGenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
    }),
  ).rejects.toThrow(/no valid wardrobe items/i);

  expect(published.at(-1)?.activeJob).toMatchObject({
    status: "failed",
    phase: "failed",
  });
});

test("persisted wardrobe generation does not rollback capsule snapshots after abort", async () => {
  const updates = [];
  const abortError = new Error("job_aborted") as Error & { code?: string };
  abortError.code = "job_aborted";
  const deps = createDeps({
    generateCapsuleWardrobeImpl: vi.fn(async () => {
      throw abortError;
    }),
    updateCapsuleSnapshotImpl: vi.fn(async (_email, capsuleId, draft) => {
      updates.push({ capsuleId, draft });
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft });
    }),
  });

  await expect(
    runPersistedWardrobeGenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
    }),
  ).rejects.toMatchObject({ code: "job_aborted" });

  expect(updates).toHaveLength(1);
  expect(updates[0].draft.data.regeneration).toMatchObject({
    status: "pending",
    kind: "full",
  });
});

test("persisted wardrobe generation fails instead of completing after swimwear abort", async () => {
  const controller = new AbortController();
  const published = [];
  const swimwearSignals = [];
  const deps = createDeps({
    generateCapsuleWardrobeImpl: vi.fn(async () =>
      buildWardrobeGenerationResult({
        items: [createItem("top-1"), createItem("bottom-1", "bottom")],
        selectedItems: [createItem("top-1"), createItem("bottom-1", "bottom")],
        promptEmbeddings: [0.1],
      }),
    ),
    shouldGenerateSwimwearImpl: vi.fn(() => true),
    generateSwimwearAdditionImpl: vi.fn(async (payload) => {
      swimwearSignals.push(payload.signal);
      controller.abort();
      return {
        items: [createItem("swim-1", "swimwear")],
        reasoning: null,
        rawSelectionText: null,
      };
    }),
    publishSnapshotImpl: vi.fn((_email, _capsuleId, snapshot) => {
      published.push(snapshot);
    }),
  });

  await expect(
    runPersistedWardrobeGenerationJobForService(deps, {
      email: "person@example.com",
      capsuleId: "capsule-1",
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "job_aborted" });

  expect(swimwearSignals).toEqual([controller.signal]);
  expect(published.at(-1)?.activeJob).toMatchObject({
    status: "failed",
    phase: "failed",
  });
  expect(published.at(-1)?.activeJob).not.toMatchObject({
    status: "completed",
  });
});
