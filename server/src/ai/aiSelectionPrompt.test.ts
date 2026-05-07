import { test, expect } from "vitest";
import {
  getWardrobeSelectionPrompt,
  toWardrobeUiItem
} from "./aiSelectionPrompt.js";

test("getWardrobeSelectionPrompt includes optional additional information", () => {
  const prompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "Prefer natural fabrics"
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 }
  );

  expect(prompt).toMatch(/Important Additional Information: Prefer natural fabrics/);
});

test("getWardrobeSelectionPrompt omits additional information line when text is blank", () => {
  const prompt = getWardrobeSelectionPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "   "
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 }
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
      pattern: "solid"
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    { top: 1 }
  );

  expect(prompt).toMatch(/No accent color \(keep the capsule fully neutral\)/);
  expect(prompt).toMatch(/solid \(no print\)/);
});

test("toWardrobeUiItem preserves audience for downstream UI labeling", () => {
  expect(toWardrobeUiItem({
      id: "top-1",
      url: "https://example.com/top-1",
      name: "Pocketable Parka",
      category: "outerwear",
      image_url: "https://example.com/top-1.jpg",
      audience: "all"
    })).toEqual({
      id: "top-1",
      url: "https://example.com/top-1",
      name: "Pocketable Parka",
      category: "outerwear",
      image_url: "https://example.com/top-1.jpg",
      audience: "all"
    });
});
