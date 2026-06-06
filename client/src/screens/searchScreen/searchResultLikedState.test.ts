import { describe, expect, test } from "vitest";
import { markSearchResultLikeState } from "./searchResultLikedState";

describe("searchResultLikedState", () => {
  test("updates every search result with the same canonical URL", () => {
    const items = [
      { id: 1, url: "https://example.com/item", isLiked: false },
      { id: 2, url: "https://example.com/other", isLiked: false },
      { id: 3, url: "https://example.com/item" },
    ];

    expect(markSearchResultLikeState(items, items[0], true)).toEqual([
      { id: 1, url: "https://example.com/item", isLiked: true },
      { id: 2, url: "https://example.com/other", isLiked: false },
      { id: 3, url: "https://example.com/item", isLiked: true },
    ]);
  });

  test("returns the current list when the item has no canonical URL", () => {
    const items = [{ id: 1, isLiked: false }];

    expect(markSearchResultLikeState(items, { id: 2 }, true)).toBe(items);
  });
});
