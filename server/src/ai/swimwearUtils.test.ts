import { test, expect } from "vitest";
import {
  dedupeStrings,
  formatItemColor,
  getItemColors,
  sanitizeProductRow,
  shouldGenerateSwimwear,
  toWardrobeUiItem
} from "./swimwearUtils.js";

test("shouldGenerateSwimwear recognizes summer from scalar and array seasons", () => {
  expect(shouldGenerateSwimwear({ season: " summer " })).toBe(true);
  expect(shouldGenerateSwimwear({ season: ["spring", "SUMMER"] })).toBe(true);
  expect(shouldGenerateSwimwear({ season: ["winter"] })).toBe(false);
  expect(shouldGenerateSwimwear(null)).toBe(false);
});

test("swimwear color helpers dedupe category colors and format color descriptions", () => {
  const items = [
    { category: "swimwear", color_base: [" Blue ", "white"], pattern: "stripe", is_neutral: true },
    { category: "swimwear", color_base: ["blue"] },
    { category: "top", color_base: ["black"] }
  ];

  expect(dedupeStrings(["blue", "", "blue", "white"])).toEqual(["blue", "white"]);
  expect(getItemColors(items, "swimwear")).toEqual(["blue", "white"]);
  expect(formatItemColor(items[0])).toBe(" Blue , white, stripe, neutral");
  expect(formatItemColor({})).toBe("not specified");
});

test("sanitizeProductRow removes embedding metadata and toWardrobeUiItem maps UI fields", () => {
  expect(sanitizeProductRow(null)).toBe(null);
  expect(sanitizeProductRow({ id: "p1", name: "Suit", embedding: [1, 2], distance: 0.5 })).toEqual({ id: "p1", name: "Suit" });
  expect(toWardrobeUiItem({
      id: "p1",
      url: "https://example.test/p1",
      name: "Suit",
      category: "swimwear",
      image_url: "https://example.test/p1.jpg",
      audience: "woman"
    })).toEqual({
      id: "p1",
      url: "https://example.test/p1",
      name: "Suit",
      category: "swimwear",
      image_url: "https://example.test/p1.jpg",
      audience: "woman"
    });
});
