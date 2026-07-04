import { test, expect } from "vitest";
import { createWardrobeService } from "./aiService.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildWardrobeGenerationResult,
  buildWardrobeUiItem,
} from "../test/domainFixtures.js";

function createCapsuleWithWardrobe(wardrobe = null) {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      data: {
        wardrobe,
        rejectedUrls: [],
        regeneration: null,
      },
    }),
  });
}

test("clearWardrobeJobsForEmail removes normalized email-owned jobs only", () => {
  const job = {
    capsuleRequestId: "request-1",
    status: "pending" as const,
    startedAt: 1,
    updatedAt: 1,
    promise: null,
    phase: "capsule" as const,
    result: null,
  };
  const jobs = new Map([
    ["person@example.com", job],
    ["person@example.com::capsule-1", job],
    ["other@example.com::capsule-1", job],
  ]);
  const service = createWardrobeService({ jobs });

  service.clearWardrobeJobsForEmail(" PERSON@example.com ");
  service.clearWardrobeJobsForEmail("");

  expect([...jobs.keys()]).toEqual(["other@example.com::capsule-1"]);
});

test("startWardrobeJob reuses active pending job for the same email", async () => {
  let resolveGeneration;
  const pendingGeneration = new Promise<
    ReturnType<typeof buildWardrobeGenerationResult>
  >((resolve) => {
    resolveGeneration = resolve;
  });
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => pendingGeneration,
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) =>
      buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    jobs: new Map(),
  });

  const first = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ locale: "en" }),
    createCapsuleWithWardrobe(null),
  );
  const second = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ locale: "en" }),
    createCapsuleWithWardrobe(null),
  );

  expect(first).toBe(second);

  resolveGeneration(
    buildWardrobeGenerationResult({
      items: [
        buildWardrobeUiItem({
          id: "top-1",
          category: "top",
          url: undefined,
          name: undefined,
          imageUrl: undefined,
          audience: undefined,
        }),
      ],
      selectedItems: [
        buildWardrobeUiItem({
          id: "top-1",
          category: "top",
          url: undefined,
          name: undefined,
          imageUrl: undefined,
          audience: undefined,
        }),
      ],
      promptEmbeddings: [0.1],
    }),
  );
  await first.promise;
});

test("startWardrobeJob stores capsule result and merges swimwear additions when enabled", async () => {
  const updates = [];
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () =>
      buildWardrobeGenerationResult({
        items: [
          buildWardrobeUiItem({
            id: "top-1",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
          buildWardrobeUiItem({
            id: "top-2",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
          buildWardrobeUiItem({
            id: "bottom-1",
            category: "bottom",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
          buildWardrobeUiItem({
            id: "bag-1",
            category: "bag",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
        ],
        selectedItems: [
          buildWardrobeUiItem({
            id: "top-1",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
          buildWardrobeUiItem({
            id: "top-2",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
          buildWardrobeUiItem({
            id: "bottom-1",
            category: "bottom",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
          buildWardrobeUiItem({
            id: "bag-1",
            category: "bag",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
        ],
        promptEmbeddings: [0.1],
        outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
        rawSelectionText: "capsule-raw",
      }),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({
        id: capsuleId,
        draft,
        saved: null,
      });
    },
    shouldGenerateSwimwearImpl: () => true,
    generateSwimwearAdditionImpl: async () => ({
      items: [
        buildWardrobeUiItem({
          id: "swim-1",
          category: "swimwear",
          url: "https://example.com/swim-1",
          name: "Swim 1",
          imageUrl: "https://example.com/swim-1.jpg",
          audience: "woman",
        }),
        buildWardrobeUiItem({
          id: "top-1",
          category: "top",
          url: "https://example.com/top-1",
          name: "Top 1",
          imageUrl: "https://example.com/top-1.jpg",
          audience: "woman",
        }),
      ],
      reasoning: "swimwear-json",
      rawSelectionText: "swimwear-raw",
    }),
    jobs: new Map(),
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({
      audience: "woman",
      season: ["summer"],
      locale: "en",
    }),
    createCapsuleWithWardrobe(null),
  );
  await job.promise;

  expect(job.status).toBe("completed");
  expect(job.phase).toBe("completed");
  expect(updates).toEqual([
    [
      "person@example.com",
      "capsule-1",
      {
        filters: createCapsuleWithWardrobe().draft.filters,
        data: {
          wardrobe: {
            items: [
              buildWardrobeUiItem({
                id: "top-1",
                category: "top",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "top-2",
                category: "top",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "bottom-1",
                category: "bottom",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "bag-1",
                category: "bag",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
            ],
            outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
            rawSelectionText: "capsule-raw",
            swimwearReasoning: null,
            swimwearRawSelectionText: null,
          },
          rejectedUrls: [],
          regeneration: null,
        },
      },
    ],
    [
      "person@example.com",
      "capsule-1",
      {
        filters: createCapsuleWithWardrobe().draft.filters,
        data: {
          wardrobe: {
            items: [
              buildWardrobeUiItem({
                id: "top-1",
                category: "top",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "top-2",
                category: "top",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "bottom-1",
                category: "bottom",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "bag-1",
                category: "bag",
                url: undefined,
                name: undefined,
                imageUrl: undefined,
                audience: undefined,
              }),
              buildWardrobeUiItem({
                id: "swim-1",
                category: "swimwear",
                url: "https://example.com/swim-1",
                name: "Swim 1",
                imageUrl: "https://example.com/swim-1.jpg",
                audience: "woman",
              }),
              buildWardrobeUiItem({
                id: "top-1",
                category: "top",
                url: "https://example.com/top-1",
                name: "Top 1",
                imageUrl: "https://example.com/top-1.jpg",
                audience: "woman",
              }),
            ],
            outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
            rawSelectionText: "capsule-raw",
            swimwearReasoning: "swimwear-json",
            swimwearRawSelectionText: "swimwear-raw",
          },
          rejectedUrls: [],
          regeneration: null,
        },
      },
    ],
  ]);
});

test("startWardrobeJob completes anchored swimwear even when seasonal swimwear generation is disabled", async () => {
  const updates = [];
  const swimwearCalls = [];
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () =>
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
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({
        id: capsuleId,
        draft,
        saved: null,
      });
    },
    shouldGenerateSwimwearImpl: () => false,
    generateSwimwearAdditionImpl: async (payload) => {
      swimwearCalls.push(payload);
      return {
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
      };
    },
    jobs: new Map(),
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ audience: "woman", season: ["winter"] }),
    createCapsuleWithWardrobe(null),
  );
  await job.promise;

  expect(swimwearCalls).toHaveLength(1);
  expect(swimwearCalls[0].selectedCapsuleItems).toEqual([
    buildWardrobeUiItem({
      id: "W12",
      category: "swimwear",
      url: "wardrobe://12",
      name: "Bikini Bottom",
      imageUrl: undefined,
      audience: "woman",
      swimwearType: "swimwear_bottom",
    }),
  ]);
  expect(
    updates.at(-1)?.[2].data.wardrobe.items.map((item) => item.id),
  ).toEqual(["W12", "swim-top-1"]);
});

test("startWardrobeJob renames a new capsule from stylist short_capsule_name on first content generation", async () => {
  const renamedCapsules = [];
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () =>
      buildWardrobeGenerationResult({
        items: [
          buildWardrobeUiItem({
            id: "top-1",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
        ],
        selectedItems: [
          buildWardrobeUiItem({
            id: "top-1",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
        ],
        promptEmbeddings: [0.1],
        shortCapsuleName: "City Core",
      }),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) =>
      buildNormalizedCapsuleRecord({
        id: capsuleId,
        name: "<New capsule>",
        draft,
        saved: null,
        status: "new",
      }),
    renameCapsuleImpl: async (email, capsuleId, name) => {
      renamedCapsules.push([email, capsuleId, name]);
      return buildNormalizedCapsuleRecord({
        id: capsuleId,
        name,
        draft: createCapsuleWithWardrobe(null).draft,
        saved: null,
        status: "new",
      });
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs: new Map(),
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ audience: "woman", locale: "en" }),
    createCapsuleWithWardrobe(null),
  );
  await job.promise;

  expect(renamedCapsules).toEqual([
    ["person@example.com", "capsule-1", "City Core"],
  ]);
});

test("startWardrobeJob does not rename capsule when wardrobe content already exists", async () => {
  let renameCallCount = 0;
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () =>
      buildWardrobeGenerationResult({
        items: [
          buildWardrobeUiItem({
            id: "top-1",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
        ],
        selectedItems: [
          buildWardrobeUiItem({
            id: "top-1",
            category: "top",
            url: undefined,
            name: undefined,
            imageUrl: undefined,
            audience: undefined,
          }),
        ],
        promptEmbeddings: [0.1],
        shortCapsuleName: "City Core",
      }),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) =>
      buildNormalizedCapsuleRecord({
        id: capsuleId,
        name: "<New capsule>",
        draft,
        saved: null,
        status: "new",
      }),
    renameCapsuleImpl: async () => {
      renameCallCount += 1;
      return null;
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs: new Map(),
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ audience: "woman", locale: "en" }),
    createCapsuleWithWardrobe({
      items: [
        buildWardrobeUiItem({
          id: "existing-top-1",
          category: "top",
          url: undefined,
          name: undefined,
          imageUrl: undefined,
          audience: undefined,
        }),
      ],
    }),
  );
  await job.promise;

  expect(renameCallCount).toBe(0);
});

test("startWardrobeJob marks job failed when capsule generation returns no usable items", async () => {
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult(),
    jobs: new Map(),
  });
  const originalError = console.error;
  const calls = [];

  console.error = (...args) => {
    calls.push(args);
  };

  try {
    const job = service.startWardrobeJob(
      "person@example.com",
      "capsule-1",
      buildNormalizedProfileRecord({ audience: "woman", locale: "en" }),
      createCapsuleWithWardrobe(null),
    );
    await job.promise;

    expect(job.status).toBe("failed");
    expect(job.phase).toBe("failed");
    expect((job.error as Error).message).toMatch(/no valid wardrobe items/i);
  } finally {
    console.error = originalError;
  }

  expect(calls.length).toBe(1);
  const errorLog = JSON.parse(String(calls[0][0]));
  expect(errorLog.message).toBe("[wardrobe-ai]");
  expect(String(errorLog.values[2]?.message || "")).toMatch(
    /no valid wardrobe items/i,
  );
});
