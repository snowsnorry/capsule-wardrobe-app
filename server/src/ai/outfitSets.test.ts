import { test, expect } from "vitest";
import { buildOutfitSetsFromFormulas } from "./outfitSets.js";

test("buildOutfitSetsFromFormulas keeps only valid outfit compositions and deduplicates categories", () => {
  expect(buildOutfitSetsFromFormulas(
      [
        "Top, bottom, bag [1] + [2] + [3].",
        "Dress look [4] + [5].",
        "Missing bottom [1] + [3] + [5].",
        "Keep first top [1] + [6] + [2] + [3].",
        "Keep first bottom [1] + [7] + [8] + [3]."
      ],
      [
        { id: "1", category: "top" },
        { id: "2", category: "bottom" },
        { id: "3", category: "bag" },
        { id: "4", category: "dress" },
        { id: "5", category: "shoes" },
        { id: "6", category: "top" },
        { id: "7", category: "bottom" },
        { id: "8", category: "bottom" }
      ]
    )).toEqual([
      { itemIds: ["1", "2", "3"] },
      { itemIds: ["4", "5"] },
      { itemIds: ["1", "2", "3"] },
      { itemIds: ["1", "7", "3"] }
    ]);
});
