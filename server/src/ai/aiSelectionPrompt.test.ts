import { test, expect } from "vitest";
import {
  getWardrobeSelectionPrompt,
  toWardrobeUiItem,
} from "./aiSelectionPrompt.js";

test("getWardrobeSelectionPrompt includes optional additional information", () => {
  const prompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "Prefer natural fabrics",
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 },
  );

  expect(prompt).toMatch(
    /Important Additional Information: Prefer natural fabrics/,
  );
});

test("getWardrobeSelectionPrompt omits additional information line when text is blank", () => {
  const prompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "   ",
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 },
  );

  expect(prompt).not.toMatch(/Important Additional Information:/);
});

test("getWardrobeSelectionPrompt includes no-accent and solid guidance by default", () => {
  const prompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      color: null,
      pattern: "solid",
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 },
  );

  expect(prompt).toMatch(/No accent color \(keep the capsule fully neutral\)/);
  expect(prompt).toMatch(/solid \(no print\)/);
});

test("getWardrobeSelectionPrompt renders wardrobe preference rules only for wardrobe mode", () => {
  const catalogPrompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      formalityLevel: "casual",
      sourceMode: "catalog_only",
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 },
  );
  const wardrobePrompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      formalityLevel: "casual",
      sourceMode: "wardrobe_preferred",
    },
    [{ id: "W7", item_source: "wardrobe", name: "Top", category: "top" }],
    { top: 1 },
  );

  expect(catalogPrompt).not.toMatch(
    /Wardrobe items are items the user already owns/,
  );
  expect(catalogPrompt).toMatch(/"item_source": "catalog"/);
  expect(wardrobePrompt).toMatch(
    /Prefer wardrobe items over catalog items when they are similarly suitable/,
  );
  expect(wardrobePrompt).toMatch(/"item_source": "wardrobe"/);
});

test("toWardrobeUiItem preserves detail fields for downstream UI labeling", () => {
  expect(
    toWardrobeUiItem({
      id: "top-1",
      url: "https://example.com/top-1",
      name: "Pocketable Parka",
      description: "Lightweight shell",
      brand: "Studio",
      category: "outerwear",
      image_url: "https://example.com/top-1.jpg",
      raw_image_url: "https://example.com/top-1-original.jpg",
      audience: "all",
      season: ["summer"],
      formality_level: ["casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      color_base: ["green"],
      pattern: "solid",
      finish: "matte",
      is_neutral: false,
      composition: "nylon",
      silhouette: "straight",
      fit: "regular",
      closure_type: ["zipper"],
      source: "uploaded",
      processing_status: "ready",
      wardrobe_id: "7",
    }),
  ).toEqual({
    id: "top-1",
    url: "https://example.com/top-1",
    name: "Pocketable Parka",
    description: "Lightweight shell",
    brand: "Studio",
    category: "outerwear",
    imageUrl: "https://example.com/top-1.jpg",
    rawImageUrl: "https://example.com/top-1-original.jpg",
    audience: "all",
    season: ["summer"],
    formalityLevel: ["casual"],
    itemSource: "catalog",
    style: ["minimalistic"],
    occasions: ["office"],
    colorBase: ["green"],
    pattern: "solid",
    finish: "matte",
    isNeutral: false,
    composition: "nylon",
    silhouette: "straight",
    fit: "regular",
    closureType: ["zipper"],
    source: "uploaded",
    processingStatus: "ready",
    wardrobeId: "7",
  });
});
