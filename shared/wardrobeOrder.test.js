import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_ORDER, sortWardrobeItems } from "./wardrobeOrder.js";

test("sortWardrobeItems orders known categories by priority and names within a category", () => {
  const items = [
    { id: "3", category: "top", name: "Zulu Shirt" },
    { id: "1", category: "outerwear", name: "Blazer" },
    { id: "2", category: "top", name: "Alpha Shirt" },
    { id: "4", category: "bottom", name: "Trousers" }
  ];

  const sorted = sortWardrobeItems(items);

  assert.deepEqual(sorted.map((item) => item.id), ["1", "2", "3", "4"]);
  assert.deepEqual(items.map((item) => item.id), ["3", "1", "2", "4"]);
});

test("sortWardrobeItems pushes unknown categories after known ones and sorts them by name", () => {
  const items = [
    { id: "2", category: "mystery", name: "Beta" },
    { id: "1", category: "unknown", name: "Alpha" },
    { id: "3", category: "bag", name: "Carryall" }
  ];

  const sorted = sortWardrobeItems(items);

  assert.deepEqual(sorted.map((item) => item.id), ["3", "1", "2"]);
  assert.equal(CATEGORY_ORDER.at(-1), "swimwear");
});
