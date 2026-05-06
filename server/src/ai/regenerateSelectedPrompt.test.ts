import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt
} from "./regenerateSelectedPrompt.js";

test("buildRegenerateSelectedPrompt includes optional additional information", () => {
  const prompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "Prefer natural fabrics"
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    [{ id: "bottom-1", name: "Bottom", category: "bottom" }],
    { top: 1 }
  );

  assert.match(prompt, /Important Additional Information: Prefer natural fabrics/);
});

test("buildRegenerateSelectedPrompt omits additional information line when text is blank", () => {
  const prompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "   "
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    [{ id: "bottom-1", name: "Bottom", category: "bottom" }],
    { top: 1 }
  );

  assert.doesNotMatch(prompt, /Important Additional Information:/);
});

test("buildRegenerateSelectedSystemPrompt uses partial regeneration template and shared blocks", () => {
  const prompt = buildRegenerateSelectedSystemPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"],
    style: "minimalistic",
    color: "red"
  });

  assert.match(prompt, /Select targeted replacement items/);
  assert.match(prompt, /Current Capsule/);
  assert.match(prompt, /"regenerated_items"/);
  assert.match(prompt, /- woman:/);
  assert.match(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.doesNotMatch(prompt, /"capsule":/);
  assert.doesNotMatch(prompt, /\{\{/);
});
