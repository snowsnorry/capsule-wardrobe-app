import { describe, expect, test } from "vitest";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "./likedItemState";

describe("likedItemState", () => {
  test("reads canonical URLs and liked state from item-like objects", () => {
    expect(getCanonicalItemUrl({ url: " wardrobe://1 " })).toBe("wardrobe://1");
    expect(getCanonicalItemUrl(null)).toBe("");
    expect(isLikedItem({ isLiked: true })).toBe(true);
    expect(isLikedItem({ isLiked: false })).toBe(false);
  });

  test("patchLikedStateByUrl updates every nested item with the same URL", () => {
    const current = {
      items: [
        { url: "https://example.com/1", isLiked: false },
        { url: "https://example.com/2", isLiked: false },
      ],
      snapshot: {
        wardrobe: {
          items: [{ url: "https://example.com/1", name: "same item" }],
        },
      },
    };

    expect(
      patchLikedStateByUrl(current, "https://example.com/1", true),
    ).toEqual({
      items: [
        { url: "https://example.com/1", isLiked: true },
        { url: "https://example.com/2", isLiked: false },
      ],
      snapshot: {
        wardrobe: {
          items: [
            {
              url: "https://example.com/1",
              name: "same item",
              isLiked: true,
            },
          ],
        },
      },
    });
  });

  test("patchLikedStateByUrl is a no-op for blank URLs and non-plain values", () => {
    const value = [{ url: "https://example.com/1", isLiked: false }, null];

    expect(patchLikedStateByUrl(value, "", true)).toBe(value);
    expect(
      patchLikedStateByUrl(new Date(0), "https://example.com/1", true),
    ).toBeInstanceOf(Date);
  });
});
