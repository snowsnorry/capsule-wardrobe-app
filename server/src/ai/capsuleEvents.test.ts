import test from "node:test";
import assert from "node:assert/strict";
import { buildCapsuleEventSnapshot } from "./capsuleEvents.js";

test("buildCapsuleEventSnapshot includes pending outfit set image indexes", () => {
  const snapshot = buildCapsuleEventSnapshot({
    capsule: {
      draft: {
        filters: {},
        data: {
          wardrobe: {
            items: [{ id: "top-1" }],
            outfitSets: [{
              itemIds: ["top-1", "bottom-1", "bag-1"],
              image: "base64"
            }]
          },
          rejectedUrls: []
        }
      },
      saved: null
    },
    outfitSetImageJob: {
      status: "pending",
      pendingSetIndexes: [1, 0]
    }
  });

  assert.deepEqual(snapshot.pendingImageSetIndexes, [0, 1]);
  assert.deepEqual(snapshot.outfitSets, [{
    itemIds: ["top-1", "bottom-1", "bag-1"],
    image: "base64",
    imageObsolete: false
  }]);
});
