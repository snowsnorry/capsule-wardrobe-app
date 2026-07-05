import { test, expect } from "vitest";
import {
  buildPromptFromTemplate,
  runOutfitSetImageGenerationJob,
} from "./outfitSetImages.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildStoredOutfitSet,
} from "../test/domainFixtures.js";

function createCapsule() {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      filters: { formalityLevel: "casual" },
      data: {
        wardrobe: {
          items: [
            {
              id: "top-1",
              imageUrl: "https://example.com/top.jpg",
              category: "top",
            },
            {
              id: "bottom-1",
              imageUrl: "https://example.com/bottom.jpg",
              category: "bottom",
            },
            {
              id: "bag-1",
              imageUrl: "https://example.com/bag.jpg",
              category: "bag",
            },
          ],
          outfitSets: [
            buildStoredOutfitSet({ itemIds: ["top-1", "bottom-1", "bag-1"] }),
          ],
          rawSelectionText: null,
          swimwearReasoning: null,
          swimwearRawSelectionText: null,
        },
        rejectedUrls: [],
      },
    }),
    saved: null,
  });
}

function createImageAssets() {
  return {
    "top-1": {
      buffer: Buffer.from("top"),
      mimeType: "image/jpeg",
      source: "download",
      imageUrl: "https://example.com/top.jpg",
      originalImageUrl: "https://example.com/top.jpg",
      width: 100,
      height: 100,
    },
    "bottom-1": {
      buffer: Buffer.from("bottom"),
      mimeType: "image/jpeg",
      source: "download",
      imageUrl: "https://example.com/bottom.jpg",
      originalImageUrl: "https://example.com/bottom.jpg",
      width: 100,
      height: 100,
    },
    "bag-1": {
      buffer: Buffer.from("bag"),
      mimeType: "image/jpeg",
      source: "download",
      imageUrl: "https://example.com/bag.jpg",
      originalImageUrl: "https://example.com/bag.jpg",
      width: 100,
      height: 100,
    },
  };
}

function createRunnerDeps(overrides = {}) {
  return {
    getCapsuleImpl: async () => createCapsule(),
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "openai:gpt-image-2",
      }),
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: () => undefined,
    generateImageWithGeminiImpl: async () => ({
      response: null,
      image: null,
    }),
    generateImageWithOpenAiImpl: async () => ({
      response: null,
      image: {
        base64: "generated-base64",
        mimeType: "image/png",
      },
    }),
    uploadImageToR2Impl: async () => ({
      key: "outfit-set-images/generated/capsule-1/0/digest.png",
      url: "https://images.example.com/generated.png",
      digest: "digest",
    }),
    downloadProductImageAssetsImpl: async () => createImageAssets(),
    updateCapsuleSavedSnapshotImpl: async (_email, _capsuleId, draft) =>
      buildNormalizedCapsuleRecord({
        ...createCapsule(),
        saved: draft,
      }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) =>
      buildNormalizedCapsuleRecord({
        ...createCapsule(),
        draft,
      }),
    ...overrides,
  };
}

test("buildPromptFromTemplate injects description into prompt template", () => {
  const prompt = buildPromptFromTemplate(
    [
      { imageUrl: "https://example.com/top.jpg" },
      { imageUrl: "https://example.com/bottom.jpg" },
    ],
    {
      promptTemplate: "Prompt\n{{description}}",
      buildOutfitSetDescriptionImpl: () => "Desc",
    },
  );

  expect(prompt).toMatch(/Desc/);
  expect(prompt).not.toMatch(/Source item image URLs:/);
});

test("buildPromptFromTemplate appends description when YAML user prompt has no placeholder", () => {
  const prompt = buildPromptFromTemplate(
    [{ imageUrl: "https://example.com/top.jpg" }],
    {
      promptTemplate: "Prompt without placeholder",
      buildOutfitSetDescriptionImpl: () => "Desc <raw>",
    },
  );

  expect(prompt).toBe("Prompt without placeholder\n\nDesc <raw>");
  expect(prompt).not.toMatch(/&lt;/);
});

test("persisted outfit-set image job runs without process-local state and propagates abort signals", async () => {
  const signal = new AbortController().signal;
  const updates = [];
  const providerSignals = [];
  const result = await runOutfitSetImageGenerationJob({
    deps: createRunnerDeps({
      generateImageWithOpenAiImpl: async (_prompt, options) => {
        providerSignals.push(options.signal);
        return {
          response: null,
          image: {
            base64: "generated-base64",
            mimeType: "image/png",
          },
        };
      },
      updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
        updates.push(draft);
        return buildNormalizedCapsuleRecord({
          ...createCapsule(),
          draft,
        });
      },
    }),
    email: "person@example.com",
    capsuleId: "capsule-1",
    setIndex: 0,
    signal,
  });

  expect(result).toEqual({ capsuleId: "capsule-1", setIndex: 0 });
  expect(providerSignals).toEqual([signal]);
  expect(updates).toHaveLength(1);
  expect(updates[0].data.wardrobe.outfitSets[0].image).toBe(
    "https://images.example.com/generated.png",
  );
});

test("persisted outfit-set image snapshot keeps pending set indexes from other active jobs", async () => {
  const snapshots = [];
  const listActiveJobsForEntityImpl = async () => [
    { id: "job-current", payload: { setIndex: 0 } },
    { id: "job-next", payload: { setIndex: 1 } },
  ];

  await runOutfitSetImageGenerationJob({
    deps: createRunnerDeps({
      listActiveJobsForEntityImpl,
      publishSnapshotImpl: (_email, _capsuleId, snapshot) => {
        snapshots.push(snapshot);
      },
    }),
    email: "person@example.com",
    capsuleId: "capsule-1",
    setIndex: 0,
    jobId: "job-current",
  });

  expect(snapshots.at(-1)?.outfitSetImageJob).toEqual({
    status: "pending",
    pendingSetIndexes: [1],
  });
});

test("persisted outfit-set image job marks generated image obsolete after newer set edits", async () => {
  const updates = [];
  let getCapsuleCallCount = 0;

  await runOutfitSetImageGenerationJob({
    deps: createRunnerDeps({
      getCapsuleImpl: async () => {
        const capsule = createCapsule();
        if (getCapsuleCallCount++ > 0) {
          capsule.draft.data.wardrobe.outfitSets = [
            buildStoredOutfitSet({ itemIds: ["top-1", "bottom-1", "hat-1"] }),
          ];
        }
        return capsule;
      },
      updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
        updates.push(draft);
        return buildNormalizedCapsuleRecord({
          ...createCapsule(),
          draft,
        });
      },
    }),
    email: "person@example.com",
    capsuleId: "capsule-1",
    setIndex: 0,
  });

  expect(updates[0].data.wardrobe.outfitSets[0]).toMatchObject({
    image: "https://images.example.com/generated.png",
    imageObsolete: true,
  });
});

test("persisted outfit-set image job validates missing capsules, sets, and set items", async () => {
  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps(),
      email: "person@example.com",
      capsuleId: "",
      setIndex: 0,
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });

  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps({ getCapsuleImpl: async () => null }),
      email: "person@example.com",
      capsuleId: "missing",
      setIndex: 0,
    }),
  ).rejects.toMatchObject({ code: "not_found" });

  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps(),
      email: "person@example.com",
      capsuleId: "capsule-1",
      setIndex: 99,
    }),
  ).rejects.toMatchObject({ code: "not_found" });

  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps({
        getCapsuleImpl: async () => {
          const capsule = createCapsule();
          capsule.draft.data.wardrobe.outfitSets = [
            buildStoredOutfitSet({ itemIds: ["top-1", "bottom-1"] }),
          ];
          return capsule;
        },
      }),
      email: "person@example.com",
      capsuleId: "capsule-1",
      setIndex: 0,
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });
});

test("persisted outfit-set image job supports gemini and saved-snapshot writes", async () => {
  const geminiCalls = [];
  const savedUpdates = [];
  const savedOnlyCapsule = buildNormalizedCapsuleRecord({
    id: "capsule-1",
    draft: null,
    saved: createCapsule().draft,
    status: "saved",
  });

  await runOutfitSetImageGenerationJob({
    deps: createRunnerDeps({
      getCapsuleImpl: async () => savedOnlyCapsule,
      getProfileImpl: async () =>
        buildNormalizedProfileRecord({
          imageLlm: "gemini:gemini-3-pro-image",
        }),
      generateImageWithGeminiImpl: async (_prompt, options) => {
        geminiCalls.push(options);
        return {
          response: null,
          image: {
            base64: "generated-base64",
            mimeType: "image/png",
          },
        };
      },
      updateCapsuleSavedSnapshotImpl: async (_email, _capsuleId, draft) => {
        savedUpdates.push(draft);
        return buildNormalizedCapsuleRecord({
          ...savedOnlyCapsule,
          saved: draft,
        });
      },
      updateCapsuleSnapshotImpl: async () => {
        throw new Error("unexpected_draft_write");
      },
    }),
    email: "person@example.com",
    capsuleId: "capsule-1",
    setIndex: 0,
  });

  expect(geminiCalls).toHaveLength(1);
  expect(savedUpdates[0].data.wardrobe.outfitSets[0].image).toBe(
    "https://images.example.com/generated.png",
  );
});

test("persisted outfit-set image job skips final write if latest capsule disappears", async () => {
  const updates = [];
  let getCapsuleCallCount = 0;

  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps({
        getCapsuleImpl: async () =>
          getCapsuleCallCount++ === 0 ? createCapsule() : null,
        updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
          updates.push(draft);
          return buildNormalizedCapsuleRecord({
            ...createCapsule(),
            draft,
          });
        },
      }),
      email: "person@example.com",
      capsuleId: "capsule-1",
      setIndex: 0,
    }),
  ).resolves.toEqual({ capsuleId: "capsule-1", setIndex: 0 });

  expect(updates).toEqual([]);
});

test("persisted outfit-set image job skips final write if latest set is gone", async () => {
  const updates = [];
  let getCapsuleCallCount = 0;

  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps({
        getCapsuleImpl: async () => {
          const capsule = createCapsule();
          if (getCapsuleCallCount++ > 0) {
            capsule.draft.data.wardrobe.outfitSets = [];
          }
          return capsule;
        },
        updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
          updates.push(draft);
          return buildNormalizedCapsuleRecord({
            ...createCapsule(),
            draft,
          });
        },
      }),
      email: "person@example.com",
      capsuleId: "capsule-1",
      setIndex: 0,
    }),
  ).resolves.toEqual({ capsuleId: "capsule-1", setIndex: 0 });

  expect(updates).toEqual([]);
});

test("persisted outfit-set image job does not persist after abort", async () => {
  const controller = new AbortController();
  const updates = [];

  await expect(
    runOutfitSetImageGenerationJob({
      deps: createRunnerDeps({
        generateImageWithOpenAiImpl: async () => {
          controller.abort();
          return {
            response: null,
            image: {
              base64: "generated-base64",
              mimeType: "image/png",
            },
          };
        },
        updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
          updates.push(draft);
          return buildNormalizedCapsuleRecord({
            ...createCapsule(),
            draft,
          });
        },
      }),
      email: "person@example.com",
      capsuleId: "capsule-1",
      setIndex: 0,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "job_aborted" });

  expect(updates).toEqual([]);
});

test("persisted outfit-set image job rejects invalid requests before writes", async () => {
  const deps = createRunnerDeps({
    updateCapsuleSnapshotImpl: async () => {
      throw new Error("unexpected_write");
    },
  });

  await expect(
    runOutfitSetImageGenerationJob({
      deps,
      email: "person@example.com",
      capsuleId: "",
      setIndex: 0,
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });
});
