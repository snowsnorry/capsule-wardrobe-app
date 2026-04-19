import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptFromTemplate, createOutfitSetImageService } from "./outfitSetImages.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
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
          reasoning: null,
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

test("outfitSetImage service starts job and persists generated image", async () => {
  const published = [];
  const updates = [];
  const prompts = [];
  const imagePayloads = [];
  const service = createOutfitSetImageService({
    getCapsuleImpl: async () => createCapsule(),
    buildCapsuleEventSnapshotImpl: (payload) => payload,
    publishSnapshotImpl: (...args) => {
      published.push(args);
    },
    generateImageWithGeminiImpl: async (prompt, { images }) => {
      prompts.push(prompt);
      imagePayloads.push(images);
      return {
        response: null,
        image: {
          base64: "generated-base64",
          mimeType: "image/png"
        }
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
  assert.equal(updates[0].data.wardrobe.outfitSets[0].image, "generated-base64");
  assert.equal(updates[0].data.wardrobe.outfitSets[0].imageObsolete, false);
  assert.equal(published.length, 2);
  assert.match(prompts[0], /top-down flat lay photograph/i);
  assert.equal(imagePayloads[0].length, 3);
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
          reasoning: null,
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
