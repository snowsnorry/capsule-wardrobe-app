import test from "node:test";
import assert from "node:assert/strict";
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

  assert.match(prompt, /Important Additional Information: Prefer natural fabrics/);
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

  assert.doesNotMatch(prompt, /Important Additional Information:/);
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

  assert.match(prompt, /No accent color \(keep the capsule fully neutral\)/);
  assert.match(prompt, /solid \(no print\)/);
});

test("toWardrobeUiItem preserves audience for downstream UI labeling", () => {
  assert.deepEqual(
    toWardrobeUiItem({
      id: "top-1",
      url: "https://example.com/top-1",
      name: "Pocketable Parka",
      category: "outerwear",
      image_url: "https://example.com/top-1.jpg",
      audience: "all"
    }),
    {
      id: "top-1",
      url: "https://example.com/top-1",
      name: "Pocketable Parka",
      category: "outerwear",
      image_url: "https://example.com/top-1.jpg",
      audience: "all"
    }
  );
});
