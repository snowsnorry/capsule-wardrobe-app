import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCapsuleFilters, normalizeCapsuleSnapshot } from "./capsuleStore.js";

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
