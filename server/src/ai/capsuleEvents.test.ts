import { test, expect } from "vitest";
import {
  buildCapsuleEventSnapshot,
  getStoredWardrobePayload,
} from "./capsuleEvents.js";

test("getStoredWardrobePayload normalizes legacy arrays and object payloads", () => {
  expect(
    getStoredWardrobePayload({
      items: [{ id: "1" }],
    }),
  ).toEqual({
    items: [{ id: "1" }],
    outfitSets: [],
    rawSelectionText: null,
    swimwearReasoning: null,
    swimwearRawSelectionText: null,
  });

  expect(
    getStoredWardrobePayload({
      items: {
        items: [{ id: "2" }],
        outfitSets: [{ itemIds: ["2"] }],
        rawSelectionText: "raw",
        swimwearReasoning: "swim",
        swimwearRawSelectionText: "swim-raw",
      },
    }),
  ).toEqual({
    items: [{ id: "2" }],
    outfitSets: [{ itemIds: ["2"] }],
    rawSelectionText: "raw",
    swimwearReasoning: "swim",
    swimwearRawSelectionText: "swim-raw",
  });
});

test("buildCapsuleEventSnapshot includes pending outfit set image indexes", () => {
  const snapshot = buildCapsuleEventSnapshot({
    capsule: {
      draft: {
        filters: {},
        data: {
          wardrobe: {
            items: [{ id: "top-1" }],
            outfitSets: [
              {
                itemIds: ["top-1", "bottom-1", "bag-1"],
                image: "base64",
              },
            ],
          },
          rejectedUrls: [],
        },
      },
      saved: null,
    },
    outfitSetImageJob: {
      status: "pending",
      pendingSetIndexes: [1, 0],
    },
  });

  expect(snapshot.pendingImageSetIndexes).toEqual([0, 1]);
  expect(snapshot.outfitSets).toEqual([
    {
      itemIds: ["top-1", "bottom-1", "bag-1"],
      image: "base64",
      imageObsolete: false,
    },
  ]);
});

test("buildCapsuleEventSnapshot marks stored item urls as pending during full regeneration", () => {
  const snapshot = buildCapsuleEventSnapshot({
    capsule: {
      draft: {
        filters: {},
        data: {
          wardrobe: {
            items: [
              { id: "top-1", url: "https://example.com/top-1" },
              { id: "bottom-1", url: "https://example.com/bottom-1" },
              { id: "bag-1", url: "" },
            ],
            outfitSets: [],
          },
          rejectedUrls: [],
          regeneration: {
            status: "pending",
            kind: "full",
            startedAt: "2026-04-24T00:00:00.000Z",
            requestId: "req-1",
          },
        },
      },
      saved: null,
    },
    activeJob: {
      status: "pending",
      phase: "capsule",
    },
  });

  expect(snapshot.status).toBe("pending");
  expect(snapshot.pendingStage).toBe("capsule");
  expect(snapshot.pendingRegenerationUrls).toEqual([
    "https://example.com/top-1",
    "https://example.com/bottom-1",
  ]);
});
