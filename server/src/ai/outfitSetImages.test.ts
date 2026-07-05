import { test, expect } from "vitest";
import {
  buildPromptFromTemplate,
  createOutfitSetImageService,
  runOutfitSetImageGenerationJob,
} from "./outfitSetImages.js";
import {
  clearOutfitSetImageJobsForEmail,
  createOutfitSetImageJobKey,
  deleteOutfitSetImageJob,
  getOutfitSetImageJobByKey,
  setPendingOutfitSetImageJob,
} from "./outfitSetImageJobs.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildStoredOutfitSet,
} from "../test/domainFixtures.js";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

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

test("clearOutfitSetImageJobsForEmail removes normalized email-owned jobs only", () => {
  const ownedKey = createOutfitSetImageJobKey(
    "person@example.com",
    "capsule-1",
    0,
  );
  const otherOwnedKey = createOutfitSetImageJobKey(
    "PERSON@example.com",
    "capsule-2",
    1,
  );
  const otherUserKey = createOutfitSetImageJobKey(
    "other@example.com",
    "capsule-1",
    0,
  );
  setPendingOutfitSetImageJob(ownedKey, { status: "pending", setIndex: 0 });
  setPendingOutfitSetImageJob(otherOwnedKey, {
    status: "pending",
    setIndex: 1,
  });
  setPendingOutfitSetImageJob(otherUserKey, {
    status: "pending",
    setIndex: 0,
  });

  clearOutfitSetImageJobsForEmail(" person@example.com ");
  clearOutfitSetImageJobsForEmail("");

  expect(getOutfitSetImageJobByKey(ownedKey)).toBeUndefined();
  expect(getOutfitSetImageJobByKey(otherOwnedKey)).toBeUndefined();
  expect(getOutfitSetImageJobByKey(otherUserKey)).toEqual({
    status: "pending",
    setIndex: 0,
  });

  deleteOutfitSetImageJob(otherUserKey);
});

test("outfitSetImage service validates missing set index", async () => {
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "bad" },
    },
    res,
  );

  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: "invalid_payload" });
});

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

test("outfitSetImage service starts job and persists generated image", async () => {
  const published = [];
  const updates = [];
  const prompts = [];
  const imagePayloads = [];
  const models = [];
  const uploads = [];
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "openai:gpt-image-2",
      }),
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: (...args) => {
      published.push(args);
    },
    generateImageWithOpenAiImpl: async (prompt, { images, model }) => {
      prompts.push(prompt);
      imagePayloads.push(images);
      models.push(model);
      return {
        response: null,
        image: {
          base64: "generated-base64",
          mimeType: "image/png",
        },
      };
    },
    uploadImageToR2Impl: async (input) => {
      uploads.push(input);
      return {
        key: "outfit-set-images/generated/capsule-1/0/digest.png",
        url: "https://images.example.com/outfit-set-images/generated/capsule-1/0/digest.png",
        digest: "digest",
      };
    },
    downloadProductImageAssetsImpl: async () => ({
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
    }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      updates.push(draft);
      return buildNormalizedCapsuleRecord({
        ...createCapsule(),
        draft,
      });
    },
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(202);
  expect(res.body).toEqual({ ok: true, status: "pending" });

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(updates.length).toBe(1);
  expect(updates[0].data.wardrobe.outfitSets[0].image).toBe(
    "https://images.example.com/outfit-set-images/generated/capsule-1/0/digest.png",
  );
  expect(updates[0].data.wardrobe.outfitSets[0].imageObsolete).toBe(false);
  expect(published.length).toBe(2);
  expect(prompts[0]).toMatch(/top-down flat lay photograph/i);
  expect(imagePayloads[0].length).toBe(3);
  expect(models).toEqual(["gpt-image-2"]);
  expect(uploads.length).toBe(1);
  expect(uploads[0].mimeType).toBe("image/png");
  expect(uploads[0].capsuleId).toBe("capsule-1");
  expect(uploads[0].setIndex).toBe(0);
});

test("outfitSetImage service persists generated images into saved capsules without drafts", async () => {
  const draftUpdates = [];
  const savedUpdates = [];
  const savedOnlyCapsule = buildNormalizedCapsuleRecord({
    id: "capsule-1",
    draft: null,
    saved: buildCapsuleSnapshot({
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
      report: { verdict: { score: 0.9 } },
    }),
  });
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => savedOnlyCapsule,
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "openai:gpt-image-2",
      }),
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: () => {},
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
    downloadProductImageAssetsImpl: async () => ({
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
    }),
    updateCapsuleSavedSnapshotImpl: async (_email, _capsuleId, saved) => {
      savedUpdates.push(saved);
      return buildNormalizedCapsuleRecord({
        ...savedOnlyCapsule,
        draft: null,
        saved,
      });
    },
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      draftUpdates.push(draft);
      return buildNormalizedCapsuleRecord({
        ...savedOnlyCapsule,
        draft,
      });
    },
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(202);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(draftUpdates).toEqual([]);
  expect(savedUpdates.length).toBe(1);
  expect(savedUpdates[0].data.wardrobe.outfitSets[0].image).toBe(
    "https://images.example.com/generated.png",
  );
  expect(savedUpdates[0].report).toEqual({ verdict: { score: 0.9 } });
});

test("outfitSetImage service does not discard a draft created while generation is pending", async () => {
  const draftUpdates = [];
  const savedUpdates = [];
  const savedOnlyCapsule = buildNormalizedCapsuleRecord({
    id: "capsule-1",
    draft: null,
    saved: buildCapsuleSnapshot({
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
  });
  const latestDraftCapsule = buildNormalizedCapsuleRecord({
    ...savedOnlyCapsule,
    draft: buildCapsuleSnapshot({
      filters: { formalityLevel: "formal" },
      data: {
        wardrobe: {
          items: [
            ...savedOnlyCapsule.saved.data.wardrobe.items,
            {
              id: "shoe-1",
              imageUrl: "https://example.com/shoe.jpg",
              category: "shoes",
            },
          ],
          outfitSets: [
            buildStoredOutfitSet({ itemIds: ["top-1", "bottom-1", "shoe-1"] }),
          ],
          rawSelectionText: "edited draft",
          swimwearReasoning: null,
          swimwearRawSelectionText: null,
        },
        rejectedUrls: ["https://example.com/rejected"],
      },
    }),
  });
  let getCapsuleCalls = 0;
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => {
      getCapsuleCalls += 1;
      return getCapsuleCalls === 1 ? savedOnlyCapsule : latestDraftCapsule;
    },
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "openai:gpt-image-2",
      }),
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: () => {},
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
    downloadProductImageAssetsImpl: async () => ({
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
    }),
    updateCapsuleSavedSnapshotImpl: async (_email, _capsuleId, saved) => {
      savedUpdates.push(saved);
      return buildNormalizedCapsuleRecord({
        ...latestDraftCapsule,
        draft: null,
        saved,
      });
    },
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      draftUpdates.push(draft);
      return buildNormalizedCapsuleRecord({
        ...latestDraftCapsule,
        draft,
      });
    },
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(202);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(getCapsuleCalls).toBe(2);
  expect(savedUpdates).toEqual([]);
  expect(draftUpdates.length).toBe(1);
  expect(draftUpdates[0].filters.formalityLevel).toBe("formal");
  expect(draftUpdates[0].data.rejectedUrls).toEqual([
    "https://example.com/rejected",
  ]);
  expect(draftUpdates[0].data.wardrobe.outfitSets[0].itemIds).toEqual([
    "top-1",
    "bottom-1",
    "shoe-1",
  ]);
  expect(draftUpdates[0].data.wardrobe.outfitSets[0].image).toBe(
    "https://images.example.com/generated.png",
  );
  expect(draftUpdates[0].data.wardrobe.outfitSets[0].imageObsolete).toBe(true);
});

test("outfitSetImage service uses gemini image provider from profile setting", async () => {
  const geminiCalls = [];
  const openAiCalls = [];
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "gemini:gemini-3-pro-image",
      }),
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: () => {},
    generateImageWithOpenAiImpl: async (...args) => {
      openAiCalls.push(args);
      throw new Error("unexpected_openai_call");
    },
    generateImageWithGeminiImpl: async (prompt, { images, model }) => {
      geminiCalls.push({ prompt, images, model });
      return {
        response: null,
        image: {
          base64: "generated-by-gemini",
          mimeType: "image/png",
        },
      };
    },
    uploadImageToR2Impl: async () => ({
      key: "outfit-set-images/generated/capsule-1/0/gemini.png",
      url: "https://images.example.com/gemini.png",
      digest: "gemini",
    }),
    downloadProductImageAssetsImpl: async () => ({
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
    }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) =>
      buildNormalizedCapsuleRecord({
        ...createCapsule(),
        draft,
      }),
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(202);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(openAiCalls.length).toBe(0);
  expect(geminiCalls.length).toBe(1);
  expect(geminiCalls[0].model).toBe("gemini-3-pro-image");
  expect(geminiCalls[0].images.length).toBe(3);
});

test("outfitSetImage service treats an existing URL image as ready", async () => {
  const capsule = createCapsule();
  capsule.draft.data.wardrobe.outfitSets[0].image =
    "https://images.example.com/existing.png";
  let generateCalls = 0;
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => capsule,
    generateImageWithOpenAiImpl: async () => {
      generateCalls += 1;
      return {
        response: null,
        image: {
          base64: "generated-base64",
          mimeType: "image/png",
        },
      };
    },
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ ok: true, status: "ready" });
  expect(generateCalls).toBe(0);
});

test("outfitSetImage service maps missing capsule, missing set, and invalid item payloads", async () => {
  const missingCapsuleService = createOutfitSetImageService({
    getCapsuleImpl: async () => null,
  });
  const missingCapsuleRes = createResponseRecorder();
  await missingCapsuleService.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    missingCapsuleRes,
  );
  expect(missingCapsuleRes.statusCode).toBe(404);
  expect(missingCapsuleRes.body).toEqual({ error: "not_found" });

  const missingSetService = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
  });
  const missingSetRes = createResponseRecorder();
  await missingSetService.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "3" },
    },
    missingSetRes,
  );
  expect(missingSetRes.statusCode).toBe(404);
  expect(missingSetRes.body).toEqual({ error: "not_found" });

  const invalidCapsule = createCapsule();
  invalidCapsule.draft.data.wardrobe.outfitSets[0].itemIds = ["top-1"];
  const invalidItemsService = createOutfitSetImageService({
    getCapsuleImpl: async () => invalidCapsule,
  });
  const invalidItemsRes = createResponseRecorder();
  await invalidItemsService.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    invalidItemsRes,
  );
  expect(invalidItemsRes.statusCode).toBe(400);
  expect(invalidItemsRes.body).toEqual({ error: "invalid_payload" });
});

test("outfitSetImage service reuses an active pending image job", async () => {
  let generationCalls = 0;
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "openai:gpt-image-2",
      }),
    publishSnapshotImpl: () => {},
    downloadProductImageAssetsImpl: async () => new Promise(() => {}),
    generateImageWithOpenAiImpl: async () => {
      generationCalls += 1;
      return {
        response: null,
        image: {
          base64: "generated-base64",
          mimeType: "image/png",
        },
      };
    },
  });

  const firstRes = createResponseRecorder();
  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    firstRes,
  );

  const secondRes = createResponseRecorder();
  await service.generateOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    secondRes,
  );

  expect(firstRes.statusCode).toBe(202);
  expect(firstRes.body).toEqual({ ok: true, status: "pending" });
  expect(secondRes.statusCode).toBe(202);
  expect(secondRes.body).toEqual({ ok: true, status: "pending" });
  expect(generationCalls).toBe(0);
});

test("persisted outfit-set image job runs without process-local state and propagates abort signals", async () => {
  const signal = new AbortController().signal;
  const updates = [];
  const providerSignals = [];
  const result = await runOutfitSetImageGenerationJob({
    deps: {
      getCapsuleImpl: async () => createCapsule(),
      getProfileImpl: async () =>
        buildNormalizedProfileRecord({
          imageLlm: "openai:gpt-image-2",
        }),
      buildCapsuleEventSnapshotImpl: (payload) => payload,
      publishSnapshotImpl: () => undefined,
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
      uploadImageToR2Impl: async () => ({
        key: "outfit-set-images/generated/capsule-1/0/digest.png",
        url: "https://images.example.com/generated.png",
        digest: "digest",
      }),
      downloadProductImageAssetsImpl: async () => ({
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
      }),
      updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
        updates.push(draft);
        return buildNormalizedCapsuleRecord({
          ...createCapsule(),
          draft,
        });
      },
    },
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

test("persisted outfit-set image job does not persist after abort", async () => {
  const controller = new AbortController();
  const updates = [];

  await expect(
    runOutfitSetImageGenerationJob({
      deps: {
        getCapsuleImpl: async () => createCapsule(),
        getProfileImpl: async () =>
          buildNormalizedProfileRecord({
            imageLlm: "openai:gpt-image-2",
          }),
        buildCapsuleEventSnapshotImpl: (payload) => payload,
        publishSnapshotImpl: () => undefined,
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
        uploadImageToR2Impl: async () => ({
          key: "outfit-set-images/generated/capsule-1/0/digest.png",
          url: "https://images.example.com/generated.png",
          digest: "digest",
        }),
        downloadProductImageAssetsImpl: async () => ({
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
        }),
        updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
          updates.push(draft);
          return buildNormalizedCapsuleRecord({
            ...createCapsule(),
            draft,
          });
        },
      },
      email: "person@example.com",
      capsuleId: "capsule-1",
      setIndex: 0,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "job_aborted" });

  expect(updates).toEqual([]);
});

test("deleteOutfitSetImage clears stored image and publishes updated snapshot", async () => {
  const published = [];
  const updates = [];
  const capsuleWithImage = createCapsule();
  capsuleWithImage.draft.data.wardrobe.outfitSets = [
    {
      itemIds: ["top-1", "bottom-1", "bag-1"],
      image: "abc123",
      imageObsolete: true,
    },
  ];

  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => capsuleWithImage,
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: (...args) => {
      published.push(args);
    },
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      updates.push(draft);
      return buildNormalizedCapsuleRecord({
        ...capsuleWithImage,
        draft,
      });
    },
  });
  const res = createResponseRecorder();

  await service.deleteOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ ok: true, status: "ready" });
  expect(updates.length).toBe(1);
  expect(updates[0].data.wardrobe.outfitSets[0].image).toBe(null);
  expect(updates[0].data.wardrobe.outfitSets[0].imageObsolete).toBe(false);
  expect(published.length).toBe(1);
});

test("deleteOutfitSetImage writes a draft when the capsule only has saved data", async () => {
  const published = [];
  const updates = [];
  const savedOnlyCapsule = buildNormalizedCapsuleRecord({
    id: "capsule-1",
    draft: null,
    saved: buildCapsuleSnapshot({
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
            buildStoredOutfitSet({
              itemIds: ["top-1", "bottom-1", "bag-1"],
              image: "saved-image",
              imageObsolete: true,
            }),
          ],
          rawSelectionText: null,
          swimwearReasoning: null,
          swimwearRawSelectionText: null,
        },
        rejectedUrls: [],
      },
    }),
  });

  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => savedOnlyCapsule,
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: (...args) => {
      published.push(args);
    },
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      updates.push(draft);
      return buildNormalizedCapsuleRecord({
        ...savedOnlyCapsule,
        draft,
        saved: savedOnlyCapsule.saved,
      });
    },
  });
  const res = createResponseRecorder();

  await service.deleteOutfitSetImage(
    {
      user: { email: "person@example.com" },
      params: { id: "capsule-1", setIndex: "0" },
    },
    res,
  );

  expect(res.statusCode).toBe(200);
  expect(updates.length).toBe(1);
  expect(updates[0].data.wardrobe.outfitSets[0].image).toBe(null);
  expect(updates[0].data.wardrobe.outfitSets[0].imageObsolete).toBe(false);
  expect(savedOnlyCapsule.saved.data.wardrobe.outfitSets[0].image).toBe(
    "saved-image",
  );
  expect(published.length).toBe(1);
});
