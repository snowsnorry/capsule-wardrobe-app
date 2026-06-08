import { test, expect } from "vitest";
import { buildLastPromptArtifact } from "./regenerateSelectedArtifacts.js";
import {
  buildRegeneratedItemsFormat,
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt,
  buildStoredWardrobePayloadFromResult,
  formatProfileValues,
  getCategoryListText,
  getSqlRows,
  isValidSelectedItemUrls,
  remapOutfitSetsAfterPartialRegeneration,
  simplifyPromptItems,
} from "./regenerateSelectedPrompt.js";

test("buildRegenerateSelectedPrompt includes optional additional information", () => {
  const prompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "Prefer natural fabrics",
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    [{ id: "bottom-1", name: "Bottom", category: "bottom" }],
    { top: 1 },
  );

  expect(prompt).toMatch(
    /Important Additional Information: Prefer natural fabrics/,
  );
});

test("buildRegenerateSelectedPrompt omits additional information line when text is blank", () => {
  const prompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "   ",
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    [{ id: "bottom-1", name: "Bottom", category: "bottom" }],
    { top: 1 },
  );

  expect(prompt).not.toMatch(/Important Additional Information:/);
});

test("buildRegenerateSelectedPrompt includes wardrobe source metadata and source-mode rules", () => {
  const snakeCaseWardrobeCandidates = [
    {
      id: "W7",
      item_source: "wardrobe",
      name: "Owned Top",
      category: "top",
    },
  ] as unknown as Parameters<typeof buildRegenerateSelectedPrompt>[1];
  const wardrobePreferredPrompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      sourceMode: "wardrobe_preferred",
    },
    snakeCaseWardrobeCandidates,
    [],
    { top: 1 },
  );
  const wardrobeOnlyPrompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      sourceMode: "wardrobe_only",
    },
    [
      {
        id: "W8",
        itemSource: "wardrobe",
        name: "Owned Shorts",
        category: "bottom",
      },
    ],
    [],
    { bottom: 1 },
  );
  const catalogPrompt = buildRegenerateSelectedPrompt(
    { audience: "woman", sourceMode: "catalog_only" },
    [{ id: "catalog-1", name: "Catalog Top", category: "top" }],
    [],
    { top: 1 },
  );

  expect(wardrobePreferredPrompt).toMatch(/"item_source": "wardrobe"/);
  expect(wardrobePreferredPrompt).toMatch(
    /Prefer wardrobe items over catalog items when they are similarly suitable/,
  );
  expect(wardrobeOnlyPrompt).toMatch(/"item_source": "wardrobe"/);
  expect(wardrobeOnlyPrompt).toMatch(
    /Use only the provided Personal items candidates/,
  );
  expect(wardrobeOnlyPrompt).toMatch(/Catalog substitutions are not available/);
  expect(catalogPrompt).toMatch(/"item_source": "catalog"/);
  expect(catalogPrompt).not.toMatch(
    /Wardrobe items are items the user already owns/,
  );
});

test("buildRegenerateSelectedSystemPrompt uses partial regeneration template and shared blocks", () => {
  const prompt = buildRegenerateSelectedSystemPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"],
    style: "minimalistic",
    color: "red",
  });

  expect(prompt).toMatch(/Select targeted replacement items/);
  expect(prompt).toMatch(/Current Capsule/);
  expect(prompt).toMatch(/"regenerated_items"/);
  expect(prompt).toMatch(/- woman:/);
  expect(prompt).toMatch(/PALETTE REFERENCE BY ACCENT COLOR/);
  expect(prompt).not.toMatch(/"capsule":/);
  expect(prompt).not.toMatch(/\{\{/);
});

test("partial regeneration helpers normalize SQL rows, selected urls, and stored payloads", () => {
  expect(getSqlRows([{ id: "1" }])).toEqual([{ id: "1" }]);
  expect(getSqlRows({ count: 0 })).toEqual([]);
  expect(isValidSelectedItemUrls([" https://example.test/a "])).toBe(true);
  expect(isValidSelectedItemUrls([""])).toBe(false);
  expect(isValidSelectedItemUrls("not-array")).toBe(false);

  expect(
    buildStoredWardrobePayloadFromResult(
      {
        items: [{ id: "top-1" }],
        outfitSets: [
          {
            itemIds: ["top-1", 2],
            image: "image.jpg",
            imageObsolete: true,
          } as unknown as { itemIds: string[] },
          { itemIds: "bad" } as unknown as { itemIds: string[] },
        ],
        rawSelectionText: "raw",
      },
      {
        items: [],
        outfitSets: [],
        rawSelectionText: null,
        swimwearReasoning: "reason",
        swimwearRawSelectionText: "swimwear raw",
      },
    ),
  ).toEqual({
    items: [{ id: "top-1" }],
    outfitSets: [
      { itemIds: ["top-1", "2"], image: "image.jpg", imageObsolete: true },
      { itemIds: [], image: null, imageObsolete: false },
    ],
    rawSelectionText: "raw",
    swimwearReasoning: "reason",
    swimwearRawSelectionText: "swimwear raw",
  });
});

test("remapOutfitSetsAfterPartialRegeneration remaps replaced items and marks changed images obsolete", () => {
  const result = remapOutfitSetsAfterPartialRegeneration({
    pendingUrls: ["https://example.test/old"],
    currentItems: [
      {
        id: "old-id",
        url: "https://example.test/old",
        name: "Old",
        category: "top",
      },
    ],
    nextItems: [
      {
        id: "new-id",
        url: "https://example.test/new",
        name: "New",
        category: "top",
      },
    ],
    outfitSets: [
      { itemIds: ["old-id", ""], image: " image.jpg " },
      { itemIds: [], image: "unused.jpg" },
      { itemIds: ["keep-id"], imageObsolete: true },
    ],
  });

  expect(result).toEqual([
    { itemIds: ["new-id"], image: "image.jpg", imageObsolete: true },
    { itemIds: ["keep-id"], image: null, imageObsolete: true },
  ]);
});

test("remapOutfitSetsAfterPartialRegeneration maps collapsed bikini parts to one swimsuit", () => {
  const result = remapOutfitSetsAfterPartialRegeneration({
    pendingUrls: [
      "https://example.test/old-swim-top",
      "https://example.test/old-swim-bottom",
    ],
    currentItems: [
      {
        id: "old-swim-top",
        url: "https://example.test/old-swim-top",
        name: "Old Bikini Top",
        category: "swimwear",
      },
      {
        id: "old-swim-bottom",
        url: "https://example.test/old-swim-bottom",
        name: "Old Bikini Bottom",
        category: "swimwear",
      },
    ],
    nextItems: [
      {
        id: "new-swimsuit",
        url: "https://example.test/new-swimsuit",
        name: "New Swimsuit",
        category: "swimwear",
      },
    ],
    outfitSets: [
      {
        itemIds: ["old-swim-top", "old-swim-bottom", "keep-id"],
        image: "outfit.jpg",
      },
      { itemIds: ["old-swim-bottom"], image: "bottom-only.jpg" },
    ],
  });

  expect(result).toEqual([
    {
      itemIds: ["new-swimsuit", "keep-id"],
      image: "outfit.jpg",
      imageObsolete: true,
    },
    {
      itemIds: ["new-swimsuit"],
      image: "bottom-only.jpg",
      imageObsolete: true,
    },
  ]);
});

test("prompt formatting helpers simplify values and generated schema", () => {
  expect(formatProfileValues([" office ", "", "travel"])).toBe(
    " office , travel",
  );
  expect(formatProfileValues([])).toBe("Not specified");
  expect(formatProfileValues([""])).toBe("Not specified");
  expect(getCategoryListText({ top: 2, bottom: 0, bag: 1.5, shoes: 1 })).toBe(
    "2 top, 1 shoes",
  );

  expect(
    simplifyPromptItems([
      {
        id: "top-1",
        itemSource: "wardrobe",
        name: "Top",
        category: "top",
        colorBase: ["blue"],
        pattern: "stripe",
        finish: "matte",
        isNeutral: true,
        formalityLevel: ["casual"],
        style: ["minimalistic"],
        composition: "cotton",
        fit: " regular ",
        silhouette: " straight ",
      },
      {
        id: "bottom-1",
        name: "Bottom",
        category: "bottom",
        colorBase: ["black"],
        formalityLevel: ["formal"],
        style: null,
      },
    ]),
  ).toEqual([
    {
      id: "top-1",
      item_source: "wardrobe",
      name: "Top",
      type: "top",
      color: "blue, stripe, matte, neutral",
      formality_level: ["casual"],
      style: ["minimalistic"],
      materials: "cotton",
      fit: "regular",
      silhouette: "straight",
    },
    {
      id: "bottom-1",
      item_source: "catalog",
      name: "Bottom",
      type: "bottom",
      color: "black",
      formality_level: ["formal"],
      style: [],
      materials: "",
      fit: "",
      silhouette: "",
    },
  ]);

  const format = buildRegeneratedItemsFormat({ top: 1 });
  expect(format.name).toBe("capsule_regenerate_selected_response");
  expect(format.schema.required).toEqual([
    "system_evaluation",
    "item_details",
    "regenerated_items",
  ]);
});

test("last prompt artifact uses explicit or generated system prompt and ignores non-string prompt", () => {
  expect(buildLastPromptArtifact(null)).toBe("");
  expect(buildLastPromptArtifact("User prompt", null, "System prompt")).toBe(
    "System:\nSystem prompt\n\nUser:\nUser prompt",
  );
  expect(
    buildLastPromptArtifact("User prompt", {
      audience: "woman",
      pattern: "solid",
    }),
  ).toMatch(/System:\n[\s\S]+User:\nUser prompt/);
});
