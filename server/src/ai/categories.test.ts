import { test, expect } from "vitest";
import { getCapsuleCategories } from "./categories.js";

test("getCapsuleCategories returns the base capsule for missing profile", () => {
  expect(getCapsuleCategories()).toEqual({
    bottom: 3,
    top: 3,
    outerwear: 1,
    shoes: 2,
    belt: 1,
    bag: 2,
  });
});

test("getCapsuleCategories adds one dress for women by default", () => {
  expect(getCapsuleCategories({ audience: "woman" })).toEqual({
    bottom: 3,
    top: 3,
    outerwear: 1,
    shoes: 2,
    belt: 1,
    bag: 2,
    dress: 1,
  });
});

test("getCapsuleCategories adds midlayers and increases outerwear for cold seasons", () => {
  expect(getCapsuleCategories({ season: ["winter"] })).toEqual({
    bottom: 3,
    top: 3,
    outerwear: 2,
    shoes: 2,
    belt: 1,
    bag: 2,
    midlayer: 2,
  });
});

test("getCapsuleCategories combines women summer and transitional season rules", () => {
  expect(
    getCapsuleCategories({ audience: "woman", season: ["spring", "summer"] }),
  ).toEqual({
    bottom: 3,
    top: 3,
    outerwear: 2,
    shoes: 2,
    belt: 1,
    bag: 2,
    dress: 2,
    midlayer: 2,
  });
});

test("getCapsuleCategories accepts season as a single string", () => {
  expect(getCapsuleCategories({ season: "autumn" })).toEqual({
    bottom: 3,
    top: 3,
    outerwear: 2,
    shoes: 2,
    belt: 1,
    bag: 2,
    midlayer: 2,
  });
});

test("getCapsuleCategories returns a fresh object on each call", () => {
  const categories = getCapsuleCategories({
    audience: "woman",
    season: ["summer"],
  });
  categories.dress = 99;

  expect(
    getCapsuleCategories({ audience: "woman", season: ["summer"] }),
  ).toEqual({
    bottom: 3,
    top: 3,
    outerwear: 1,
    shoes: 2,
    belt: 1,
    bag: 2,
    dress: 2,
  });
});
