import { expect, test } from "vitest";
import {
  getOutfitReportPromptItemId,
  toOutfitReportPromptImageItem,
} from "./outfitReportItems.js";
import { buildPromptImageThumbnailUrl } from "./promptImageThumbnails.js";

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

test("toOutfitReportPromptImageItem includes thumbnail candidates from source", () => {
  const catalogImageUrl = "https://images.example.com/catalog/top.jpg";
  expect(
    toOutfitReportPromptImageItem({
      id: "catalog-top-1",
      source: "from_catalog",
      category: "top",
      imageUrl: catalogImageUrl,
    }),
  ).toMatchObject({
    id: "catalog-top-1",
    source: "from_catalog",
    imageUrl: catalogImageUrl,
    thumbnailUrl: buildPromptImageThumbnailUrl(catalogImageUrl, "from_catalog"),
  });

  expect(
    toOutfitReportPromptImageItem({
      id: "18",
      source: "uploaded",
      category: "bottom",
      imageUrl: "https://images.example.com/wardrobe/item_clean.png?x=1",
    }),
  ).toMatchObject({
    id: "W18",
    source: "uploaded",
    imageUrl: "https://images.example.com/wardrobe/item_clean.png?x=1",
    thumbnailUrl: "https://images.example.com/wardrobe/item_clean_320.webp",
  });
});
