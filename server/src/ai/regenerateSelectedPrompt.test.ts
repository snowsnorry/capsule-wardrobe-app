import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLastPromptArtifact,
  buildRegeneratedItemsFormat,
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt,
  buildStoredWardrobePayloadFromResult,
  formatProfileValues,
  getCategoryListText,
  getSqlRows,
  isValidSelectedItemUrls,
  remapOutfitSetsAfterPartialRegeneration,
  simplifyPromptItems
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

test("partial regeneration helpers normalize SQL rows, selected urls, and stored payloads", () => {
  assert.deepEqual(getSqlRows([{ id: "1" }]), [{ id: "1" }]);
  assert.deepEqual(getSqlRows({ count: 0 }), []);
  assert.equal(isValidSelectedItemUrls([" https://example.test/a "]), true);
  assert.equal(isValidSelectedItemUrls([""]), false);
  assert.equal(isValidSelectedItemUrls("not-array"), false);

  assert.deepEqual(
    buildStoredWardrobePayloadFromResult(
      {
        items: [{ id: "top-1" }],
        outfitSets: [
          { itemIds: ["top-1", 2], image: "image.jpg", imageObsolete: true } as unknown as { itemIds: string[] },
          { itemIds: "bad" } as unknown as { itemIds: string[] }
        ],
        rawSelectionText: "raw"
      },
      {
        items: [],
        outfitSets: [],
        rawSelectionText: null,
        swimwearReasoning: "reason",
        swimwearRawSelectionText: "swimwear raw"
      }
    ),
    {
      items: [{ id: "top-1" }],
      outfitSets: [
        { itemIds: ["top-1", "2"], image: "image.jpg", imageObsolete: true },
        { itemIds: [], image: null, imageObsolete: false }
      ],
      rawSelectionText: "raw",
      swimwearReasoning: "reason",
      swimwearRawSelectionText: "swimwear raw"
    }
  );
});

test("remapOutfitSetsAfterPartialRegeneration remaps replaced items and marks changed images obsolete", () => {
  const result = remapOutfitSetsAfterPartialRegeneration({
    pendingUrls: ["https://example.test/old"],
    currentItems: [{ id: "old-id", url: "https://example.test/old", name: "Old", category: "top" }],
    nextItems: [{ id: "new-id", url: "https://example.test/new", name: "New", category: "top" }],
    outfitSets: [
      { itemIds: ["old-id", ""], image: " image.jpg " },
      { itemIds: [], image: "unused.jpg" },
      { itemIds: ["keep-id"], imageObsolete: true }
    ]
  });

  assert.deepEqual(result, [
    { itemIds: ["new-id"], image: "image.jpg", imageObsolete: true },
    { itemIds: ["keep-id"], image: null, imageObsolete: true }
  ]);
});

test("prompt formatting helpers simplify values and generated schema", () => {
  assert.equal(formatProfileValues([" office ", "", "travel"]), " office , travel");
  assert.equal(formatProfileValues([]), "Not specified");
  assert.equal(formatProfileValues([""]), "Not specified");
  assert.equal(getCategoryListText({ top: 2, bottom: 0, bag: 1.5, shoes: 1 }), "2 top, 1 shoes");

  assert.deepEqual(
    simplifyPromptItems([
      {
        id: "top-1",
        name: "Top",
        category: "top",
        color_base: ["blue"],
        pattern: "stripe",
        finish: "matte",
        is_neutral: true,
        formality_level: ["casual"],
        style: ["minimalistic"],
        composition: "cotton",
        fit: " regular ",
        silhouette: " straight "
      },
      {
        id: "bottom-1",
        name: "Bottom",
        category: "bottom",
        colorBase: ["black"],
        formalityLevel: ["formal"],
        style: null
      }
    ]),
    [
      {
        id: "top-1",
        name: "Top",
        type: "top",
        color: "blue, stripe, matte, neutral",
        formality_level: ["casual"],
        style: ["minimalistic"],
        materials: "cotton",
        fit: "regular",
        silhouette: "straight"
      },
      {
        id: "bottom-1",
        name: "Bottom",
        type: "bottom",
        color: "black",
        formality_level: ["formal"],
        style: [],
        materials: "",
        fit: "",
        silhouette: ""
      }
    ]
  );

  const format = buildRegeneratedItemsFormat({ top: 1 });
  assert.equal(format.name, "capsule_regenerate_selected_response");
  assert.deepEqual(format.schema.required, ["system_evaluation", "item_details", "regenerated_items"]);
});

test("last prompt artifact uses explicit or generated system prompt and ignores non-string prompt", () => {
  assert.equal(buildLastPromptArtifact(null), "");
  assert.equal(buildLastPromptArtifact("User prompt", null, "System prompt"), "System:\nSystem prompt\n\nUser:\nUser prompt");
  assert.match(
    buildLastPromptArtifact("User prompt", { audience: "woman", pattern: "solid" }),
    /System:\n[\s\S]+User:\nUser prompt/
  );
});
