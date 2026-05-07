import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dedupeStrings,
  formatItemColor,
  getItemColors,
  sanitizeProductRow,
  shouldGenerateSwimwear,
  toWardrobeUiItem
} from "./swimwearUtils.js";

test("shouldGenerateSwimwear recognizes summer from scalar and array seasons", () => {
  assert.equal(shouldGenerateSwimwear({ season: " summer " }), true);
  assert.equal(shouldGenerateSwimwear({ season: ["spring", "SUMMER"] }), true);
  assert.equal(shouldGenerateSwimwear({ season: ["winter"] }), false);
  assert.equal(shouldGenerateSwimwear(null), false);
});

test("swimwear color helpers dedupe category colors and format color descriptions", () => {
  const items = [
    { category: "swimwear", color_base: [" Blue ", "white"], pattern: "stripe", is_neutral: true },
    { category: "swimwear", color_base: ["blue"] },
    { category: "top", color_base: ["black"] }
  ];

  assert.deepEqual(dedupeStrings(["blue", "", "blue", "white"]), ["blue", "white"]);
  assert.deepEqual(getItemColors(items, "swimwear"), ["blue", "white"]);
  assert.equal(formatItemColor(items[0]), " Blue , white, stripe, neutral");
  assert.equal(formatItemColor({}), "not specified");
});

test("sanitizeProductRow removes embedding metadata and toWardrobeUiItem maps UI fields", () => {
  assert.equal(sanitizeProductRow(null), null);
  assert.deepEqual(
    sanitizeProductRow({ id: "p1", name: "Suit", embedding: [1, 2], distance: 0.5 }),
    { id: "p1", name: "Suit" }
  );
  assert.deepEqual(
    toWardrobeUiItem({
      id: "p1",
      url: "https://example.test/p1",
      name: "Suit",
      category: "swimwear",
      image_url: "https://example.test/p1.jpg",
      audience: "woman"
    }),
    {
      id: "p1",
      url: "https://example.test/p1",
      name: "Suit",
      category: "swimwear",
      image_url: "https://example.test/p1.jpg",
      audience: "woman"
    }
  );
});
