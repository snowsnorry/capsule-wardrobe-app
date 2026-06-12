import { expect, test } from "vitest";
import { getOutfitReportPromptItemId } from "./outfitReportItems.js";

test("getOutfitReportPromptItemId prefixes wardrobe items and preserves catalog ids", () => {
  expect(getOutfitReportPromptItemId({ id: "18", source: "uploaded" })).toBe(
    "W18",
  );
  expect(
    getOutfitReportPromptItemId({ id: "19", itemSource: "wardrobe" }),
  ).toBe("W19");
  expect(getOutfitReportPromptItemId({ id: "20", wardrobeId: "20" })).toBe(
    "W20",
  );
  expect(
    getOutfitReportPromptItemId({ id: "21", profileEmail: "a@example.com" }),
  ).toBe("W21");
  expect(getOutfitReportPromptItemId({ id: "W22", source: "uploaded" })).toBe(
    "W22",
  );
  expect(
    getOutfitReportPromptItemId({ id: "23", source: "from_catalog" }),
  ).toBe("23");
});
