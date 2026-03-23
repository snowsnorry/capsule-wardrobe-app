import test from "node:test";
import assert from "node:assert/strict";
import { getCapsuleCategories } from "./ai/categories.js";

test("getCapsuleCategories returns the base capsule for missing profile", () => {
  assert.deepEqual(getCapsuleCategories(), {
    bottom: 3,
    top: 3,
    outerwear: 1,
    shoes: 2,
    belt: 1,
    bag: 2
  });
});

test("getCapsuleCategories adds one dress for women by default", () => {
  assert.deepEqual(getCapsuleCategories({ audience: "woman" }), {
    bottom: 3,
    top: 3,
    outerwear: 1,
    shoes: 2,
    belt: 1,
    bag: 2,
    dress: 1
  });
});

test("getCapsuleCategories adds midlayers and increases outerwear for cold seasons", () => {
  assert.deepEqual(getCapsuleCategories({ season: ["winter"] }), {
    bottom: 3,
    top: 3,
    outerwear: 2,
    shoes: 2,
    belt: 1,
    bag: 2,
    midlayer: 2
  });
});

test("getCapsuleCategories combines women summer and transitional season rules", () => {
  assert.deepEqual(getCapsuleCategories({ audience: "woman", season: ["spring", "summer"] }), {
    bottom: 3,
    top: 3,
    outerwear: 2,
    shoes: 2,
    belt: 1,
    bag: 2,
    dress: 2,
    midlayer: 2
  });
});

test("getCapsuleCategories accepts season as a single string", () => {
  assert.deepEqual(getCapsuleCategories({ season: "autumn" }), {
    bottom: 3,
    top: 3,
    outerwear: 2,
    shoes: 2,
    belt: 1,
    bag: 2,
    midlayer: 2
  });
});

test("getCapsuleCategories returns a fresh object on each call", () => {
  const categories = getCapsuleCategories({ audience: "woman", season: ["summer"] });
  categories.dress = 99;

  assert.deepEqual(getCapsuleCategories({ audience: "woman", season: ["summer"] }), {
    bottom: 3,
    top: 3,
    outerwear: 1,
    shoes: 2,
    belt: 1,
    bag: 2,
    dress: 2
  });
});
