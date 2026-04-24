import test from "node:test";
import assert from "node:assert/strict";
import { buildSharedCapsuleOgMetadata, normalizeCapsuleFilters, normalizeCapsuleSnapshot } from "./capsuleStore.js";

test("normalizeCapsuleFilters drops removed profile occasions and keeps supported values", () => {
  assert.deepEqual(
    normalizeCapsuleFilters({
      occasions: ["office", "school_drop-off", "everyday_errands", "weekend_with_family", "office"]
    }).occasions,
    ["office", "everyday_errands"]
  );
});

test("normalizeCapsuleSnapshot sanitizes saved profile occasions on read and write", () => {
  assert.deepEqual(
    normalizeCapsuleSnapshot({
      filters: {
        formalityLevel: "",
        style: null,
        occasions: ["office", "school_drop-off", "weekend_with_family"],
        season: [],
        audience: "",
        color: null,
        pattern: "solid",
        text: ""
      },
      data: {
        wardrobe: null,
        rejectedUrls: []
      }
    })?.filters?.occasions,
    ["office"]
  );
});

test("normalizeCapsuleSnapshot preserves outfit set image payloads", () => {
  assert.deepEqual(
    normalizeCapsuleSnapshot({
      filters: {},
      data: {
        wardrobe: {
          items: [],
          outfitSets: [{
            itemIds: ["top-1", "bottom-1", "bag-1"],
            image: "base64-image",
            imageObsolete: true
          }]
        },
        rejectedUrls: []
      }
    })?.data?.wardrobe?.outfitSets,
    [{
      itemIds: ["top-1", "bottom-1", "bag-1"],
      image: "base64-image",
      imageObsolete: true
    }]
  );
});

test("buildSharedCapsuleOgMetadata formats English filter sentences and prefers outfit set images", () => {
  const metadata = buildSharedCapsuleOgMetadata({
    name: "Spring <edit>",
    content: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office", "date_night"],
        season: ["spring"],
        audience: "woman",
        color: "light blue",
        pattern: "solid",
        text: "Do not include this"
      },
      data: {
        wardrobe: {
          items: [{ image_url: "https://images.example.com/item.jpg" }],
          outfitSets: [
            { itemIds: ["top-1"], image: "", imageObsolete: false },
            { itemIds: ["top-2"], image: "https://images.example.com/outfit.jpg", imageObsolete: false }
          ]
        },
        rejectedUrls: []
      }
    }
  });

  assert.deepEqual(metadata, {
    title: "Spring <edit>",
    description: "Formality: Casual. Style: Minimalistic. Occasions: Office, Date night. Season: Spring. Audience: Woman. Color: Light blue. Pattern: Solid.",
    image: "https://images.example.com/outfit.jpg"
  });
});

test("buildSharedCapsuleOgMetadata falls back to the first item image_url", () => {
  assert.equal(
    buildSharedCapsuleOgMetadata({
      name: "Spring edit",
      content: {
        filters: {},
        data: {
          wardrobe: {
            items: [{ image_url: "https://images.example.com/item.jpg" }],
            outfitSets: [{ itemIds: ["top-1"], image: null, imageObsolete: false }]
          },
          rejectedUrls: []
        }
      }
    })?.image,
    "https://images.example.com/item.jpg"
  );
});
