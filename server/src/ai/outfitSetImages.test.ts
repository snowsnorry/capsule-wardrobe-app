import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptFromTemplate, createOutfitSetImageService } from "./outfitSetImages.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildStoredOutfitSet
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
    }
  };
}

function createCapsule() {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      filters: { formalityLevel: "casual" },
      data: {
        wardrobe: {
          items: [
            { id: "top-1", image_url: "https://example.com/top.jpg", category: "top" },
            { id: "bottom-1", image_url: "https://example.com/bottom.jpg", category: "bottom" },
            { id: "bag-1", image_url: "https://example.com/bag.jpg", category: "bag" }
          ],
          outfitSets: [buildStoredOutfitSet({ itemIds: ["top-1", "bottom-1", "bag-1"] })],
          rawSelectionText: null,
          swimwearReasoning: null,
          swimwearRawSelectionText: null
        },
        rejectedUrls: []
      }
    }),
    saved: null
  });
}

test("outfitSetImage service validates missing set index", async () => {
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule()
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "bad" }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "invalid_payload" });
});

test("buildPromptFromTemplate injects description into prompt template", () => {
  const prompt = buildPromptFromTemplate([
    { image_url: "https://example.com/top.jpg" },
    { image_url: "https://example.com/bottom.jpg" }
  ], {
    promptTemplate: "Prompt\n{{description}}",
    buildOutfitSetDescriptionImpl: () => "Desc"
  });

  assert.match(prompt, /Desc/);
  assert.doesNotMatch(prompt, /Source item image URLs:/);
});

test("buildPromptFromTemplate appends description when YAML user prompt has no placeholder", () => {
  const prompt = buildPromptFromTemplate([
    { image_url: "https://example.com/top.jpg" }
  ], {
    promptTemplate: "Prompt without placeholder",
    buildOutfitSetDescriptionImpl: () => "Desc <raw>"
  });

  assert.equal(prompt, "Prompt without placeholder\n\nDesc <raw>");
  assert.doesNotMatch(prompt, /&lt;/);
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
    getProfileImpl: async () => buildNormalizedProfileRecord({
      imageLlm: "openai:gpt-image-2"
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
          mimeType: "image/png"
        }
      };
    },
    uploadImageToR2Impl: async (input) => {
      uploads.push(input);
      return {
        key: "outfit-set-images/generated/capsule-1/0/digest.png",
        url: "https://images.example.com/outfit-set-images/generated/capsule-1/0/digest.png",
        digest: "digest"
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
        height: 100
      },
      "bottom-1": {
        buffer: Buffer.from("bottom"),
        mimeType: "image/jpeg",
        source: "download",
        imageUrl: "https://example.com/bottom.jpg",
        originalImageUrl: "https://example.com/bottom.jpg",
        width: 100,
        height: 100
      },
      "bag-1": {
        buffer: Buffer.from("bag"),
        mimeType: "image/jpeg",
        source: "download",
        imageUrl: "https://example.com/bag.jpg",
        originalImageUrl: "https://example.com/bag.jpg",
        width: 100,
        height: 100
      }
    }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      updates.push(draft);
      return buildNormalizedCapsuleRecord({
        ...createCapsule(),
        draft
      });
    }
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { ok: true, status: "pending" });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(updates.length, 1);
  assert.equal(
    updates[0].data.wardrobe.outfitSets[0].image,
    "https://images.example.com/outfit-set-images/generated/capsule-1/0/digest.png"
  );
  assert.equal(updates[0].data.wardrobe.outfitSets[0].imageObsolete, false);
  assert.equal(published.length, 2);
  assert.match(prompts[0], /top-down flat lay photograph/i);
  assert.equal(imagePayloads[0].length, 3);
  assert.deepEqual(models, ["gpt-image-2"]);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].mimeType, "image/png");
  assert.equal(uploads[0].capsuleId, "capsule-1");
  assert.equal(uploads[0].setIndex, 0);
});

test("outfitSetImage service uses gemini image provider from profile setting", async () => {
  const geminiCalls = [];
  const openAiCalls = [];
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
    getProfileImpl: async () => buildNormalizedProfileRecord({
      imageLlm: "gemini:gemini-3-pro-image-preview"
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
          mimeType: "image/png"
        }
      };
    },
    uploadImageToR2Impl: async () => ({
      key: "outfit-set-images/generated/capsule-1/0/gemini.png",
      url: "https://images.example.com/gemini.png",
      digest: "gemini"
    }),
    downloadProductImageAssetsImpl: async () => ({
      "top-1": {
        buffer: Buffer.from("top"),
        mimeType: "image/jpeg",
        source: "download",
        imageUrl: "https://example.com/top.jpg",
        originalImageUrl: "https://example.com/top.jpg",
        width: 100,
        height: 100
      },
      "bottom-1": {
        buffer: Buffer.from("bottom"),
        mimeType: "image/jpeg",
        source: "download",
        imageUrl: "https://example.com/bottom.jpg",
        originalImageUrl: "https://example.com/bottom.jpg",
        width: 100,
        height: 100
      },
      "bag-1": {
        buffer: Buffer.from("bag"),
        mimeType: "image/jpeg",
        source: "download",
        imageUrl: "https://example.com/bag.jpg",
        originalImageUrl: "https://example.com/bag.jpg",
        width: 100,
        height: 100
      }
    }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => buildNormalizedCapsuleRecord({
      ...createCapsule(),
      draft
    })
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, res);

  assert.equal(res.statusCode, 202);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(openAiCalls.length, 0);
  assert.equal(geminiCalls.length, 1);
  assert.equal(geminiCalls[0].model, "gemini-3-pro-image-preview");
  assert.equal(geminiCalls[0].images.length, 3);
});

test("outfitSetImage service treats an existing URL image as ready", async () => {
  const capsule = createCapsule();
  capsule.draft.data.wardrobe.outfitSets[0].image = "https://images.example.com/existing.png";
  let generateCalls = 0;
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => capsule,
    generateImageWithOpenAiImpl: async () => {
      generateCalls += 1;
      return {
        response: null,
        image: {
          base64: "generated-base64",
          mimeType: "image/png"
        }
      };
    }
  });
  const res = createResponseRecorder();

  await service.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, status: "ready" });
  assert.equal(generateCalls, 0);
});

test("outfitSetImage service maps missing capsule, missing set, and invalid item payloads", async () => {
  const missingCapsuleService = createOutfitSetImageService({
    getCapsuleImpl: async () => null
  });
  const missingCapsuleRes = createResponseRecorder();
  await missingCapsuleService.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, missingCapsuleRes);
  assert.equal(missingCapsuleRes.statusCode, 404);
  assert.deepEqual(missingCapsuleRes.body, { error: "not_found" });

  const missingSetService = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule()
  });
  const missingSetRes = createResponseRecorder();
  await missingSetService.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "3" }
  }, missingSetRes);
  assert.equal(missingSetRes.statusCode, 404);
  assert.deepEqual(missingSetRes.body, { error: "not_found" });

  const invalidCapsule = createCapsule();
  invalidCapsule.draft.data.wardrobe.outfitSets[0].itemIds = ["top-1"];
  const invalidItemsService = createOutfitSetImageService({
    getCapsuleImpl: async () => invalidCapsule
  });
  const invalidItemsRes = createResponseRecorder();
  await invalidItemsService.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, invalidItemsRes);
  assert.equal(invalidItemsRes.statusCode, 400);
  assert.deepEqual(invalidItemsRes.body, { error: "invalid_payload" });
});

test("outfitSetImage service reuses an active pending image job", async () => {
  let generationCalls = 0;
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
    getProfileImpl: async () => buildNormalizedProfileRecord({
      imageLlm: "openai:gpt-image-2"
    }),
    publishSnapshotImpl: () => {},
    downloadProductImageAssetsImpl: async () => new Promise(() => {}),
    generateImageWithOpenAiImpl: async () => {
      generationCalls += 1;
      return {
        response: null,
        image: {
          base64: "generated-base64",
          mimeType: "image/png"
        }
      };
    }
  });

  const firstRes = createResponseRecorder();
  await service.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, firstRes);

  const secondRes = createResponseRecorder();
  await service.generateOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, secondRes);

  assert.equal(firstRes.statusCode, 202);
  assert.deepEqual(firstRes.body, { ok: true, status: "pending" });
  assert.equal(secondRes.statusCode, 202);
  assert.deepEqual(secondRes.body, { ok: true, status: "pending" });
  assert.equal(generationCalls, 0);
});

test("deleteOutfitSetImage clears stored image and publishes updated snapshot", async () => {
  const published = [];
  const updates = [];
  const capsuleWithImage = createCapsule();
  capsuleWithImage.draft.data.wardrobe.outfitSets = [{
    itemIds: ["top-1", "bottom-1", "bag-1"],
    image: "abc123",
    imageObsolete: true
  }];

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
        draft
      });
    }
  });
  const res = createResponseRecorder();

  await service.deleteOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, status: "ready" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.wardrobe.outfitSets[0].image, null);
  assert.equal(updates[0].data.wardrobe.outfitSets[0].imageObsolete, false);
  assert.equal(published.length, 1);
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
            { id: "top-1", image_url: "https://example.com/top.jpg", category: "top" },
            { id: "bottom-1", image_url: "https://example.com/bottom.jpg", category: "bottom" },
            { id: "bag-1", image_url: "https://example.com/bag.jpg", category: "bag" }
          ],
          outfitSets: [buildStoredOutfitSet({
            itemIds: ["top-1", "bottom-1", "bag-1"],
            image: "saved-image",
            imageObsolete: true
          })],
          rawSelectionText: null,
          swimwearReasoning: null,
          swimwearRawSelectionText: null
        },
        rejectedUrls: []
      }
    })
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
        saved: savedOnlyCapsule.saved
      });
    }
  });
  const res = createResponseRecorder();

  await service.deleteOutfitSetImage({
    user: { email: "person@example.com" },
    params: { id: "capsule-1", setIndex: "0" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.wardrobe.outfitSets[0].image, null);
  assert.equal(updates[0].data.wardrobe.outfitSets[0].imageObsolete, false);
  assert.equal(savedOnlyCapsule.saved.data.wardrobe.outfitSets[0].image, "saved-image");
  assert.equal(published.length, 1);
});
