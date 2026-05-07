import { test, expect } from "vitest";
import { buildOutfitSetDescription } from "./outfitSetImageDescription.js";

test("buildOutfitSetDescription tolerates items without type", () => {
  const description = buildOutfitSetDescription([
    { id: "1", name: "Shirt", type: "top", color: "white" },
    { id: "2", name: "Trousers", color: "black" },
    { id: "3", name: "Bag", type: "bag" },
  ]);

  expect(description).toMatch(/Shirt/);
  expect(description).toMatch(/Bag/);
});

test("buildOutfitSetDescription falls back to category when type is absent", () => {
  const description = buildOutfitSetDescription([
    { id: "1", name: "Blazer", category: "outerwear" },
    { id: "2", name: "Knit", category: "midlayer" },
    { id: "3", name: "Trousers", category: "bottom" },
    { id: "4", name: "Bag", category: "bag" },
  ]);

  expect(description).toMatch(/Blazer/);
  expect(description).toMatch(/Knit/);
  expect(description).toMatch(/Trousers/);
  expect(description).toMatch(/Bag/);
});
