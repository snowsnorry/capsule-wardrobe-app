import test from "node:test";
import assert from "node:assert/strict";
import { migrateCapsuleImagesToR2 } from "./migrateCapsuleImagesToR2.js";

function buildSnapshot(images: unknown[]) {
  return {
    filters: {},
    data: {
      wardrobe: {
        items: [],
        outfitSets: images.map((image, index) => ({
          itemIds: [`item-${index}`],
          image,
          imageObsolete: false
        })),
        reasoning: null,
        rawSelectionText: null,
        swimwearReasoning: null,
        swimwearRawSelectionText: null
      },
      rejectedUrls: []
    }
  };
}

test("migrateCapsuleImagesToR2 migrates base64 images in capsule draft and saved snapshots", async () => {
  const draftImage = Buffer.from("draft-image").toString("base64");
  const savedImage = Buffer.from("saved-image").toString("base64");
  const capsuleUpdates = [];
  const uploads = [];

  const stats = await migrateCapsuleImagesToR2({
    listCapsuleImageRowsImpl: async () => [{
      id: "capsule-1",
      draft: buildSnapshot([draftImage, "https://images.example.com/already.png", "not base64!"]),
      saved: buildSnapshot([savedImage])
    }],
    listSharedCapsuleImageRowsImpl: async () => [],
    updateCapsuleImageRowImpl: async (...args) => {
      capsuleUpdates.push(args);
    },
    uploadImageToR2Impl: async (input) => {
      uploads.push(input);
      return {
        key: `${input.namespace}/${input.capsuleId}/${input.setIndex}.png`,
        url: `https://images.example.com/${input.namespace}/${input.capsuleId}/${input.setIndex}.png`,
        digest: "digest"
      };
    }
  });

  assert.equal(stats.capsulesScanned, 1);
  assert.equal(stats.capsulesUpdated, 1);
  assert.equal(stats.imagesUploaded, 2);
  assert.equal(stats.imagesSkipped, 2);
  assert.equal(capsuleUpdates.length, 1);
  assert.equal(capsuleUpdates[0][0], "capsule-1");
  assert.equal(capsuleUpdates[0][1].data.wardrobe.outfitSets[0].image, "https://images.example.com/capsules-draft/capsule-1/0.png");
  assert.equal(capsuleUpdates[0][1].data.wardrobe.outfitSets[1].image, "https://images.example.com/already.png");
  assert.equal(capsuleUpdates[0][2].data.wardrobe.outfitSets[0].image, "https://images.example.com/capsules-saved/capsule-1/0.png");
  assert.equal(uploads[0].mimeType, "image/png");
  assert.equal(uploads[0].buffer.toString("utf8"), "draft-image");
  assert.equal(uploads[1].buffer.toString("utf8"), "saved-image");
});

test("migrateCapsuleImagesToR2 migrates shared capsule content and skips unchanged rows", async () => {
  const sharedUpdates = [];
  const base64Image = Buffer.from("shared-image").toString("base64");

  const stats = await migrateCapsuleImagesToR2({
    listCapsuleImageRowsImpl: async () => [{
      id: "capsule-with-url",
      draft: buildSnapshot(["https://images.example.com/already.png"]),
      saved: null
    }],
    listSharedCapsuleImageRowsImpl: async () => [{
      id: "share-1",
      content: buildSnapshot([base64Image, "data:image/png;base64,abc"])
    }],
    updateCapsuleImageRowImpl: async () => {
      throw new Error("unexpected_capsule_update");
    },
    updateSharedCapsuleImageRowImpl: async (...args) => {
      sharedUpdates.push(args);
    },
    uploadImageToR2Impl: async (input) => ({
      key: `${input.namespace}/${input.capsuleId}/${input.setIndex}.png`,
      url: `https://images.example.com/${input.namespace}/${input.capsuleId}/${input.setIndex}.png`,
      digest: "digest"
    })
  });

  assert.equal(stats.capsulesScanned, 1);
  assert.equal(stats.capsulesUpdated, 0);
  assert.equal(stats.sharedCapsulesScanned, 1);
  assert.equal(stats.sharedCapsulesUpdated, 1);
  assert.equal(stats.imagesUploaded, 1);
  assert.equal(stats.imagesSkipped, 2);
  assert.equal(sharedUpdates.length, 1);
  assert.equal(sharedUpdates[0][0], "share-1");
  assert.equal(sharedUpdates[0][1].data.wardrobe.outfitSets[0].image, "https://images.example.com/shared-capsules/share-1/0.png");
  assert.equal(sharedUpdates[0][1].data.wardrobe.outfitSets[1].image, "data:image/png;base64,abc");
});
