import test from "node:test";
import assert from "node:assert/strict";
import { buildOutfitSetDescription } from "./ai/outfitSetImageDescription.js";

test("buildOutfitSetDescription tolerates items without type", () => {
  const description = buildOutfitSetDescription([
    { id: "1", name: "Shirt", type: "top", color: "white" },
    { id: "2", name: "Trousers", color: "black" },
    { id: "3", name: "Bag", type: "bag" }
  ]);

  assert.match(description, /Shirt/);
  assert.match(description, /Bag/);
});

test("buildOutfitSetDescription falls back to category when type is absent", () => {
  const description = buildOutfitSetDescription([
    { id: "1", name: "Blazer", category: "outerwear" },
    { id: "2", name: "Knit", category: "midlayer" },
    { id: "3", name: "Trousers", category: "bottom" },
    { id: "4", name: "Bag", category: "bag" }
  ]);

  assert.match(description, /Blazer/);
  assert.match(description, /Knit/);
  assert.match(description, /Trousers/);
  assert.match(description, /Bag/);
});
