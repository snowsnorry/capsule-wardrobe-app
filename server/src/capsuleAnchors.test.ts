import { describe, expect, test } from "vitest";
import {
  parseAnchorPublicIds,
  validateCapsuleAnchorItems,
} from "./capsuleAnchors.js";

describe("capsuleAnchors", () => {
  test("parses public wardrobe anchor ids", () => {
    expect(parseAnchorPublicIds([" w12 ", "W12", "w18"])).toEqual({
      publicIds: ["W12", "W18"],
      numericIds: [12, 18],
    });
  });

  test("rejects malformed and excessive public wardrobe anchor ids", () => {
    expect(() => parseAnchorPublicIds(["12"])).toThrow("invalid_payload");
    expect(() =>
      parseAnchorPublicIds(["W1", "W2", "W3", "W4", "W5", "W6"]),
    ).toThrow("invalid_payload");
  });

  test("validates ownership, readiness, and category before generation", async () => {
    const result = await validateCapsuleAnchorItems({
      email: "person@example.com",
      anchorWardrobeItemIds: ["W12"],
      deps: {
        listWardrobeItemsByIdsImpl: async () => [
          {
            id: 12,
            name: "White shirt",
            category: "top",
            processing_status: "ready",
          },
        ],
      },
    });

    expect(result.anchorWardrobeItemIds).toEqual(["W12"]);
    expect(result.anchorWardrobeNumericIds).toEqual([12]);
    expect(result.anchorItems[0]).toMatchObject({
      id: "W12",
      item_source: "wardrobe",
      selection_role: "anchor",
      wardrobe_id: "12",
    });
  });

  test("rejects missing, not-ready, or category-less anchors", async () => {
    await expect(() =>
      validateCapsuleAnchorItems({
        email: "person@example.com",
        anchorWardrobeItemIds: ["W12"],
        deps: { listWardrobeItemsByIdsImpl: async () => [] },
      }),
    ).rejects.toThrow("invalid_payload");

    await expect(() =>
      validateCapsuleAnchorItems({
        email: "person@example.com",
        anchorWardrobeItemIds: ["W12"],
        deps: {
          listWardrobeItemsByIdsImpl: async () => [
            { id: 12, category: "", processing_status: "ready" },
          ],
        },
      }),
    ).rejects.toThrow("invalid_payload");
  });
});
