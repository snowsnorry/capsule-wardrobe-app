import { test, expect } from "vitest";
import {
  buildDisplayWardrobeItems,
  mergeWardrobeItemsIntoExistingOrder,
  mergeWardrobeItemsWithMetadata,
  normalizeWardrobeItemUrl,
} from "./wardrobeMerge.js";

test("normalizeWardrobeItemUrl trims item URLs and handles missing items", () => {
  expect(normalizeWardrobeItemUrl({ url: " https://example.com/a " })).toBe(
    "https://example.com/a",
  );
  expect(normalizeWardrobeItemUrl(null)).toBe("");
  expect(normalizeWardrobeItemUrl(undefined)).toBe("");
});

test("buildDisplayWardrobeItems sorts array inputs and ignores non-array inputs", () => {
  const items = [
    { id: "bottom", category: "bottom", name: "Trousers" },
    { id: "top", category: "top", name: "Shirt" },
  ];

  expect(buildDisplayWardrobeItems(items).map((item) => item.id)).toEqual([
    "top",
    "bottom",
  ]);
  expect(buildDisplayWardrobeItems("not an array")).toEqual([]);
});

test("buildDisplayWardrobeItems preserves explicit item source only", () => {
  expect(
    buildDisplayWardrobeItems([
      {
        id: "uploaded-1",
        url: "wardrobe://uploaded-1",
        category: "top",
        source: "uploaded",
      },
    ])[0],
  ).toMatchObject({ source: "uploaded" });
  expect(
    buildDisplayWardrobeItems([
      { id: "uploaded-1", url: "wardrobe://uploaded-1", category: "top" },
    ])[0],
  ).not.toHaveProperty("source");
});

test("mergeWardrobeItemsWithMetadata returns ordered next items when no pending URLs exist", () => {
  const result = mergeWardrobeItemsWithMetadata({
    currentItems: [{ id: "old", url: "old", category: "top" }],
    nextItems: [
      { id: "bottom", url: "new-bottom", category: "bottom", name: "Trousers" },
      { id: "top", url: "new-top", category: "top", name: "Shirt" },
    ],
    pendingUrls: [" "],
  });

  expect(result.items.map((item) => item.id)).toEqual(["top", "bottom"]);
  expect(result.replacementMap.size).toBe(0);
});

test("mergeWardrobeItemsWithMetadata preserves existing order and maps replacements", () => {
  const result = mergeWardrobeItemsWithMetadata({
    currentItems: [
      {
        id: "keep",
        url: "keep-url",
        category: "outerwear",
        name: "Original Coat",
        note: "old",
      },
      { id: "replace-top", url: "top-url", category: "top", name: "Old Top" },
      {
        id: "replace-shoes",
        url: "shoes-url",
        category: "shoes",
        name: "Old Shoes",
      },
    ],
    nextItems: [
      {
        id: "new-shoes",
        url: "new-shoes-url",
        category: "shoes",
        name: "New Shoes",
      },
      {
        id: "keep-new",
        url: "keep-url",
        category: "outerwear",
        name: "Updated Coat",
        note: "new",
      },
      { id: "new-top", url: "new-top-url", category: "top", name: "New Top" },
      {
        id: "extra-bag",
        url: "extra-bag-url",
        category: "bag",
        name: "Carryall",
      },
    ],
    pendingUrls: [" top-url ", "shoes-url"],
  });

  expect(result.items.map((item) => item.id)).toEqual([
    "keep-new",
    "new-top",
    "new-shoes",
    "extra-bag",
  ]);
  expect([...result.replacementMap.entries()]).toEqual([
    ["replace-top", "new-top"],
    ["replace-shoes", "new-shoes"],
  ]);
});

test("mergeWardrobeItemsWithMetadata falls back to available replacements and current items", () => {
  const result = mergeWardrobeItemsWithMetadata({
    currentItems: [
      { id: "old-top", url: "old-top-url", category: "top", name: "Old Top" },
      { id: "old-bag", url: "old-bag-url", category: "bag", name: "Old Bag" },
    ],
    nextItems: [
      {
        id: "new-bottom",
        url: "new-bottom-url",
        category: "bottom",
        name: "New Bottom",
      },
    ],
    pendingUrls: ["old-top-url", "old-bag-url"],
  });

  expect(result.items.map((item) => item.id)).toEqual([
    "new-bottom",
    "old-bag",
  ]);
  expect([...result.replacementMap.entries()]).toEqual([
    ["old-top", "new-bottom"],
    ["old-bag", "old-bag"],
  ]);
});

test("mergeWardrobeItemsWithMetadata collapses selected swimwear parts into one replacement", () => {
  const result = mergeWardrobeItemsWithMetadata({
    currentItems: [
      {
        id: "keep-top",
        url: "keep-top-url",
        category: "top",
        name: "Keep Top",
      },
      {
        id: "old-swim-top",
        url: "old-swim-top-url",
        category: "swimwear",
        name: "Old Bikini Top",
      },
      {
        id: "old-swim-bottom",
        url: "old-swim-bottom-url",
        category: "swimwear",
        name: "Old Bikini Bottom",
      },
    ],
    nextItems: [
      {
        id: "new-swimsuit",
        url: "new-swimsuit-url",
        category: "swimwear",
        name: "New Swimsuit",
      },
      {
        id: "keep-top-new",
        url: "keep-top-url",
        category: "top",
        name: "Keep Top Updated",
      },
    ],
    pendingUrls: ["old-swim-top-url", "old-swim-bottom-url"],
  });

  expect(result.items.map((item) => item.id)).toEqual([
    "keep-top-new",
    "new-swimsuit",
  ]);
  expect([...result.replacementMap.entries()]).toEqual([
    ["old-swim-top", "new-swimsuit"],
    ["old-swim-bottom", "new-swimsuit"],
  ]);
});

test("mergeWardrobeItemsIntoExistingOrder returns only merged items", () => {
  expect(
    mergeWardrobeItemsIntoExistingOrder({
      nextItems: [{ id: "top", url: "top-url", category: "top", name: "Top" }],
    }).map((item) => item.id),
  ).toEqual(["top"]);
});
