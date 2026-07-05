import { test, expect } from "vitest";
import { runOutfitImageGenerationJob } from "./outfitImages.js";
import { normalizeOutfitRecord } from "../outfitStoreModel.js";
import { buildNormalizedProfileRecord } from "../test/domainFixtures.js";

const defaultOutfitItemRefs = [
  { url: "https://example.com/top", source: "from_catalog" as const },
  { url: "https://example.com/bottom", source: "from_catalog" as const },
  { url: "https://example.com/bag", source: "from_catalog" as const },
];

function createOutfit(
  image: string | null = null,
  items = defaultOutfitItemRefs,
) {
  return normalizeOutfitRecord({
    id: "outfit-1",
    name: "Weekend",
    draft: {
      items,
      image,
      imageObsolete: Boolean(image),
    },
    saved: null,
  })!;
}

const outfitItems = [
  { id: "top-1", category: "top", imageUrl: "https://example.com/top.jpg" },
  {
    id: "bottom-1",
    category: "bottom",
    imageUrl: "https://example.com/bottom.jpg",
  },
  { id: "bag-1", category: "bag", imageUrl: "https://example.com/bag.jpg" },
];

function createRunnerDeps(overrides = {}) {
  return {
    getOutfitImpl: async () => createOutfit(),
    getOutfitItemsImpl: async () => outfitItems,
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({ imageLlm: "openai:gpt-image-2" }),
    downloadProductImageAssetsImpl: async () => ({}),
    generateImageWithGeminiImpl: async () => ({
      response: {} as never,
      image: null,
    }),
    generateImageWithOpenAiImpl: async () => ({
      response: {} as never,
      image: {
        base64: Buffer.from("image").toString("base64"),
        mimeType: "image/png",
      },
    }),
    uploadImageToR2Impl: async () => ({
      key: "outfits/outfit-1.png",
      url: "https://images.example.com/outfit-1.png",
      digest: "digest",
    }),
    updateOutfitSnapshotImpl: async (_email, _outfitId, draft) =>
      normalizeOutfitRecord({ ...createOutfit(), draft })!,
    publishSnapshotImpl: () => undefined,
    ...overrides,
  };
}

test("persisted outfit image job runs without process-local state and propagates abort signals", async () => {
  const signal = new AbortController().signal;
  const updates: unknown[] = [];
  const providerSignals: unknown[] = [];
  const result = await runOutfitImageGenerationJob({
    deps: createRunnerDeps({
      generateImageWithOpenAiImpl: async (_prompt, options) => {
        providerSignals.push(options.signal);
        return {
          response: {} as never,
          image: {
            base64: Buffer.from("image").toString("base64"),
            mimeType: "image/png",
          },
        };
      },
      updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
        updates.push(draft);
        return normalizeOutfitRecord({ ...createOutfit(), draft })!;
      },
    }),
    email: "person@example.com",
    outfitId: "outfit-1",
    signal,
  });

  expect(result).toEqual({ outfitId: "outfit-1" });
  expect(providerSignals).toEqual([signal]);
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    image: "https://images.example.com/outfit-1.png",
    imageObsolete: false,
  });
});

test("persisted outfit image snapshot keeps pending state from other active jobs", async () => {
  const snapshots = [];
  const listActiveJobsForEntityImpl = async () => [
    { id: "job-current", payload: {} },
    { id: "job-next", payload: {} },
  ];

  await runOutfitImageGenerationJob({
    deps: createRunnerDeps({
      listActiveJobsForEntityImpl,
      publishSnapshotImpl: (_email, _outfitId, snapshot) => {
        snapshots.push(snapshot);
      },
    }),
    email: "person@example.com",
    outfitId: "outfit-1",
    jobId: "job-current",
  });

  expect(snapshots.at(-1)).toMatchObject({
    status: "pending",
    pendingImage: true,
  });
});

test("persisted outfit image job marks generated image obsolete after newer item edits", async () => {
  const updates: unknown[] = [];
  const changedItems = [
    ...defaultOutfitItemRefs.slice(0, 2),
    { url: "https://example.com/hat", source: "from_catalog" as const },
  ];
  let getOutfitCallCount = 0;

  await runOutfitImageGenerationJob({
    deps: createRunnerDeps({
      getOutfitImpl: async () =>
        getOutfitCallCount++ === 0
          ? createOutfit()
          : createOutfit(null, changedItems),
      updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
        updates.push(draft);
        return normalizeOutfitRecord({ ...createOutfit(), draft })!;
      },
    }),
    email: "person@example.com",
    outfitId: "outfit-1",
  });

  expect(updates[0]).toMatchObject({
    items: changedItems,
    image: "https://images.example.com/outfit-1.png",
    imageObsolete: true,
  });
});

test("persisted outfit image job validates missing outfits and too few hydrated items", async () => {
  await expect(
    runOutfitImageGenerationJob({
      deps: createRunnerDeps(),
      email: "person@example.com",
      outfitId: "",
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });

  await expect(
    runOutfitImageGenerationJob({
      deps: createRunnerDeps({ getOutfitImpl: async () => null }),
      email: "person@example.com",
      outfitId: "missing",
    }),
  ).rejects.toMatchObject({ code: "not_found" });

  await expect(
    runOutfitImageGenerationJob({
      deps: createRunnerDeps({
        getOutfitItemsImpl: async () => outfitItems.slice(0, 2),
      }),
      email: "person@example.com",
      outfitId: "too-small",
    }),
  ).rejects.toMatchObject({ code: "invalid_payload" });
});

test("persisted outfit image job supports gemini and nullable generated images", async () => {
  const geminiCalls = [];
  const updates: unknown[] = [];

  await runOutfitImageGenerationJob({
    deps: createRunnerDeps({
      getProfileImpl: async () =>
        buildNormalizedProfileRecord({
          imageLlm: "gemini:gemini-3-pro-image",
        }),
      generateImageWithGeminiImpl: async (_prompt, options) => {
        geminiCalls.push(options);
        return { response: {} as never, image: null };
      },
      updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
        updates.push(draft);
        return normalizeOutfitRecord({ ...createOutfit(), draft })!;
      },
    }),
    email: "person@example.com",
    outfitId: "outfit-1",
  });

  expect(geminiCalls).toHaveLength(1);
  expect(updates[0]).toMatchObject({ image: null, imageObsolete: false });
});

test("persisted outfit image job does not persist after abort", async () => {
  const controller = new AbortController();
  const updates: unknown[] = [];

  await expect(
    runOutfitImageGenerationJob({
      deps: createRunnerDeps({
        generateImageWithOpenAiImpl: async () => {
          controller.abort();
          return {
            response: {} as never,
            image: {
              base64: Buffer.from("image").toString("base64"),
              mimeType: "image/png",
            },
          };
        },
        updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
          updates.push(draft);
          return normalizeOutfitRecord({ ...createOutfit(), draft })!;
        },
      }),
      email: "person@example.com",
      outfitId: "outfit-1",
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "job_aborted" });

  expect(updates).toEqual([]);
});
