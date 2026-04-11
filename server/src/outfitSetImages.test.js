import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptFromTemplate, createOutfitSetImageService } from "./ai/outfitSetImages.js";

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
  return {
    id: "capsule-1",
    draft: {
      filters: { formalityLevel: "casual" },
      data: {
        wardrobe: {
          items: [
            { id: "top-1", image_url: "https://example.com/top.jpg", type: "top" },
            { id: "bottom-1", image_url: "https://example.com/bottom.jpg", type: "bottom" },
            { id: "bag-1", image_url: "https://example.com/bag.jpg", type: "bag" }
          ],
          outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }]
        },
        rejectedUrls: []
      }
    },
    saved: null
  };
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
      image: {
        base64: "generated-base64",
        mimeType: "image/png"
      }
      };
    },
    downloadProductImageAssetsImpl: async () => ({
      "top-1": { buffer: Buffer.from("top"), mimeType: "image/jpeg" },
      "bottom-1": { buffer: Buffer.from("bottom"), mimeType: "image/jpeg" },
      "bag-1": { buffer: Buffer.from("bag"), mimeType: "image/jpeg" }
    }),
    updateCapsuleSnapshotImpl: async (_email, _capsuleId, draft) => {
      updates.push(draft);
      return {
        ...createCapsule(),
        draft
      };
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
  assert.equal(published.length, 2);
  assert.match(prompts[0], /top-down flat lay photograph/i);
  assert.equal(imagePayloads[0].length, 3);
});
