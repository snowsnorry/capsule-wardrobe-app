import test from "node:test";
import assert from "node:assert/strict";
import {
  createWardrobeService,
  enforceCategoryCounts,
  getSelectedIdsFromCapsule,
  toWardrobeUiItem,
  getWardrobeSelectionPrompt,
  getStoredWardrobePayload
} from "./ai.js";
import { buildOutfitSetsFromFormulas } from "./outfitSets.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildPartialRegenerationJobState,
  buildStoredWardrobePayload,
  buildWardrobeGenerationResult,
  buildWardrobeJobState,
  buildWardrobeUiItem
} from "../test/domainFixtures.js";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function createCapsuleWithWardrobe(wardrobe = null) {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      data: {
        wardrobe,
        rejectedUrls: []
      }
    })
  });
}

function toItemIdentity(items) {
  return items.map((item) => ({
    id: item.id,
    url: item.url,
    category: item.category
  }));
}

function toItemCategoryIdentity(items) {
  return items.map((item) => ({
    id: item.id,
    category: item.category
  }));
}

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

test("getSelectedIdsFromCapsule flattens only non-empty ids from capsule object", () => {
  assert.deepEqual(
    getSelectedIdsFromCapsule({
      top: ["1", "2", ""],
      bottom: ["3"],
      bag: null,
      misc: "nope"
    }),
    ["1", "2", "3"]
  );
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

test("enforceCategoryCounts limits style-matched additions to four when alternatives exist", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top", style: ["minimalistic"] },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"] }
    ],
    [
      { id: "top-1", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-2", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-3", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-4", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-5", category: "top", style: ["classic"], is_neutral: true },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], is_neutral: true },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], is_neutral: true },
      { id: "bottom-3", category: "bottom", style: ["classic"], is_neutral: true }
    ],
    {
      top: 3,
      bottom: 2
    },
    {
      style: "minimalistic"
    }
  );

  assert.equal(balancedItems.length, 5);
  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.style) && item.style.includes("minimalistic")).length,
    4
  );
  assert.ok(
    balancedItems.some((item) => !Array.isArray(item.style) || !item.style.includes("minimalistic"))
  );
});

test("enforceCategoryCounts limits accent color additions to three and then prefers neutral items", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-3", category: "top", color_base: ["navy"], is_neutral: true },
      { id: "bottom-1", category: "bottom", color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", color_base: ["black"], is_neutral: true },
      { id: "shoe-1", category: "shoe", color_base: ["red"], is_neutral: false },
      { id: "shoe-2", category: "shoe", color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    },
    {
      color: "red"
    }
  );

  assert.equal(balancedItems.length, 4);
  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.color_base) && item.color_base.includes("red")).length,
    3
  );
  assert.ok(
    balancedItems.some((item) => !Array.isArray(item.color_base) || !item.color_base.includes("red"))
  );
  assert.ok(balancedItems.every((item) => (
    (Array.isArray(item.color_base) && item.color_base.includes("red")) || item.is_neutral === true
  )));
});

test("enforceCategoryCounts spreads accent color items across categories before reusing the same category", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-3", category: "top", color_base: ["black"], is_neutral: true },
      { id: "bottom-1", category: "bottom", color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", color_base: ["navy"], is_neutral: true },
      { id: "shoe-1", category: "shoe", color_base: ["red"], is_neutral: false },
      { id: "shoe-2", category: "shoe", color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    },
    {
      color: "red"
    }
  );

  const redByCategory = balancedItems.reduce((result, item) => {
    if (Array.isArray(item.color_base) && item.color_base.includes("red")) {
      result[item.category] = (result[item.category] || 0) + 1;
    }
    return result;
  }, {});

  assert.equal(redByCategory.top, 1);
  assert.equal(redByCategory.bottom, 1);
  assert.equal(redByCategory.shoe, 1);
  assert.ok(balancedItems.some((item) => item.id === "top-3"));
});

test("enforceCategoryCounts counts preselected items toward style and color limits", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false }
    ],
    [
      { id: "top-1", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-3", category: "bottom", style: ["classic"], color_base: ["black"], is_neutral: true },
      { id: "shoe-1", category: "shoe", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "shoe-2", category: "shoe", style: ["classic"], color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 2,
      shoe: 1
    },
    {
      style: "minimalistic",
      color: "red"
    }
  );

  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.style) && item.style.includes("minimalistic")).length,
    3
  );
  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.color_base) && item.color_base.includes("red")).length,
    3
  );
  assert.ok(balancedItems.some((item) => item.id === "bottom-3"));
  assert.ok(balancedItems.some((item) => item.id === "shoe-2"));
});

test("enforceCategoryCounts keeps only one target pattern item and prefers solid or null for the rest", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", pattern: "Floral", is_neutral: true },
      { id: "top-2", category: "top", pattern: "solid", is_neutral: true },
      { id: "bottom-1", category: "bottom", pattern: "floral", is_neutral: true },
      { id: "bottom-2", category: "bottom", pattern: null, is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1
    },
    {
      pattern: "floral"
    }
  );

  assert.equal(
    balancedItems.filter((item) => String(item.pattern || "").toLowerCase() === "floral").length,
    1
  );
  assert.ok(
    balancedItems.every((item) => (
      String(item.pattern || "").toLowerCase() === "floral"
      || item.pattern === null
      || String(item.pattern).toLowerCase() === "solid"
    ))
  );
});

test("enforceCategoryCounts falls back when only target pattern items are available", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", pattern: "plaid" },
      { id: "top-2", category: "top", pattern: "plaid" }
    ],
    {
      top: 2
    },
    {
      pattern: "plaid"
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "top-2"]
  );
});

test("enforceCategoryCounts falls back to violating constraints when needed to fill category quotas", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", color_base: ["red"], is_neutral: false }
    ],
    {
      top: 2
    },
    {
      color: "red"
    }
  );

  assert.equal(balancedItems.length, 2);
  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "top-2"]
  );
});

test("enforceCategoryCounts keeps no-accent mode neutral unless fallback is required", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", style: ["minimalistic"], color_base: ["blue"], is_neutral: false },
      { id: "top-3", category: "top", style: ["minimalistic"], color_base: ["navy"], is_neutral: true },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], color_base: ["black"], is_neutral: true },
      { id: "shoe-1", category: "shoe", style: ["minimalistic"], color_base: ["camel"], is_neutral: false },
      { id: "shoe-2", category: "shoe", style: ["minimalistic"], color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    }
  );

  assert.equal(balancedItems.filter((item) => item.is_neutral === true).length, 3);
  assert.ok(balancedItems.some((item) => item.id === "top-3"));
  assert.ok(balancedItems.some((item) => item.id === "bottom-2"));
  assert.ok(balancedItems.some((item) => item.id === "shoe-2"));
  assert.ok(balancedItems.some((item) => item.is_neutral !== true));
});

test("enforceCategoryCounts keeps solid-only mode free of prints unless fallback is required", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", pattern: "Floral", is_neutral: true },
      { id: "top-2", category: "top", pattern: "solid", is_neutral: true },
      { id: "bottom-1", category: "bottom", pattern: "stripe", is_neutral: true },
      { id: "bottom-2", category: "bottom", pattern: null, is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1
    }
  );

  assert.equal(
    balancedItems.filter((item) => {
      const normalizedPattern = String(item.pattern || "").toLowerCase();
      return normalizedPattern !== "" && normalizedPattern !== "solid";
    }).length,
    1
  );
  assert.ok(
    balancedItems.some((item) => item.pattern === null || String(item.pattern).toLowerCase() === "solid")
  );
});

test("enforceCategoryCounts infers style from first non-minimalistic item and still allows minimalistic items", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", style: ["sporty"], is_neutral: true },
      { id: "top-2", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "bottom-1", category: "bottom", style: ["classic"], is_neutral: true },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], is_neutral: true },
      { id: "shoe-1", category: "shoe", style: ["sporty"], is_neutral: true },
      { id: "shoe-2", category: "shoe", style: ["minimalistic"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    }
  );

  assert.ok(balancedItems.some((item) => item.id === "top-1"));
  assert.ok(balancedItems.some((item) => item.id === "top-2"));
  assert.ok(balancedItems.some((item) => item.id === "bottom-2"));
  assert.ok(
    balancedItems.every((item) => {
      const styles = Array.isArray(item.style) ? item.style : [];
      return styles.includes("sporty") || styles.includes("minimalistic");
    })
  );
});

test("enforceCategoryCounts infers constraints from preselected items before filling categories", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top", style: ["sporty"], color_base: ["red"], is_neutral: false, pattern: "stripe" }
    ],
    [
      { id: "top-1", category: "top", style: ["sporty"], color_base: ["red"], is_neutral: false, pattern: "stripe" },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["black"], is_neutral: true, pattern: "solid" },
      { id: "bottom-2", category: "bottom", style: ["classic"], color_base: ["blue"], is_neutral: false, pattern: "floral" },
      { id: "shoe-1", category: "shoe", style: ["sporty"], color_base: ["red"], is_neutral: false, pattern: "solid" },
      { id: "shoe-2", category: "shoe", style: ["classic"], color_base: ["blue"], is_neutral: false, pattern: "check" }
    ],
    {
      top: 1,
      bottom: 1,
      shoe: 1
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "bottom-1", "shoe-1"]
  );
});

test("enforceCategoryCounts infers mixed style targets from the first non-minimalistic style", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", style: ["minimalistic", "sporty"] },
      { id: "top-2", category: "top", style: ["minimalistic", "classic"] },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"] },
      { id: "shoe-1", category: "shoe", style: ["sporty"] }
    ],
    {
      top: 1,
      bottom: 1,
      shoe: 1
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "bottom-1", "shoe-1"]
  );
});

test("enforceCategoryCounts preserves unique ids when selected and candidate pools overlap", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top" }
    ],
    [
      { id: "top-1", category: "top" },
      { id: "top-1", category: "top" },
      { id: "top-2", category: "top" }
    ],
    {
      top: 2
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "top-2"]
  );
});

test("getStoredWardrobePayload normalizes legacy arrays and object payloads", () => {
  assert.deepEqual(
    getStoredWardrobePayload({
      items: [{ id: "1" }]
    }),
    {
      items: [{ id: "1" }],
      outfitSets: [],
      reasoning: null,
      rawSelectionText: null,
      swimwearReasoning: null,
      swimwearRawSelectionText: null
    }
  );

  assert.deepEqual(
    getStoredWardrobePayload({
      items: {
        items: [{ id: "2" }],
        outfitSets: [{ itemIds: ["2"] }],
        reasoning: "r",
        rawSelectionText: "raw",
        swimwearReasoning: "swim",
        swimwearRawSelectionText: "swim-raw"
      }
    }),
    {
      items: [{ id: "2" }],
      outfitSets: [{ itemIds: ["2"] }],
      reasoning: "r",
      rawSelectionText: "raw",
      swimwearReasoning: "swim",
      swimwearRawSelectionText: "swim-raw"
    }
  );
});

test("buildOutfitSetsFromFormulas keeps only valid outfit compositions and deduplicates categories", () => {
  assert.deepEqual(
    buildOutfitSetsFromFormulas(
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
    ),
    [
      { itemIds: ["1", "2", "3"] },
      { itemIds: ["4", "5"] },
      { itemIds: ["1", "2", "3"] },
      { itemIds: ["1", "7", "3"] }
    ]
  );
});

test("getCapsuleItems returns pending regenerate payload when partial regeneration job is active", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", url: "https://example.com/top-1", category: "top" })],
      reasoning: "capsule",
      rawSelectionText: "raw"
    }),
    getPartialRegenerationJobImpl: () => buildPartialRegenerationJobState({
      pendingItemUrls: ["https://example.com/top-1"]
    }),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.pendingRegenerationUrls, ["https://example.com/top-1"]);
  assert.deepEqual(toItemIdentity(res.body.items), [{ id: "top-1", url: "https://example.com/top-1", category: "top" }]);
  assert.deepEqual(res.body.outfitSets, []);
});

test("getCapsuleItems returns ready payload from stored wardrobe", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
      reasoning: "capsule-json",
      rawSelectionText: "raw-selection",
      swimwearReasoning: "swimwear-json"
    }),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, "ready");
  assert.deepEqual(res.body.items, [
    buildWardrobeUiItem({
      id: "top-1",
      category: "top",
      url: undefined,
      name: undefined,
      image_url: undefined,
      audience: undefined
    })
  ]);
  assert.deepEqual(res.body.outfitSets, []);
  assert.equal(res.body.reasoning, "capsule-json");
  assert.equal(res.body.rawSelectionText, "raw-selection");
  assert.equal(res.body.swimwearReasoning, "swimwear-json");
  assert.equal(res.body.hasPendingAdditionalItems, false);
});

test("getCapsuleItems returns extras pending state when extras are still generating", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildWardrobeJobState({
      phase: "extras",
      updatedAt: Date.now()
    })]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
      reasoning: "capsule-json",
      rawSelectionText: "raw-selection",
      swimwearReasoning: "swimwear-json"
    }),
    jobs
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "extras");
  assert.equal(res.body.hasPendingAdditionalItems, true);
  assert.deepEqual(toItemCategoryIdentity(res.body.items), [{ id: "top-1", category: "top" }]);
  assert.deepEqual(res.body.outfitSets, []);
});

test("regenerateCapsuleWardrobe starts a new pending job and clears stored items", async () => {
  const updates = [];
  let generatedProfile = null;
  const jobs = new Map();
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ audience: "woman", locale: "en", llm: "openai:gpt-5.2" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })]
    }),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    generateCapsuleWardrobeImpl: async (profile) => {
      generatedProfile = profile;
      return buildWardrobeGenerationResult({
        items: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        selectedItems: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        promptEmbeddings: [0.1],
        reasoning: "reasoning",
        rawSelectionText: "raw"
      });
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs,
    randomUuidImpl: () => "req-123"
  });
  const res = createResponseRecorder();

  await service.regenerateCapsuleWardrobe({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "capsule");
  assert.deepEqual(updates[0], ["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  }]);

  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(generatedProfile.items, null);
  assert.equal(job.status, "completed");
  assert.deepEqual(updates[1], ["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: {
        items: [
          buildWardrobeUiItem({
            id: "top-2",
            category: "top",
            url: undefined,
            name: undefined,
            image_url: undefined,
            audience: undefined
          })
        ],
        outfitSets: [],
        reasoning: "reasoning",
        rawSelectionText: "raw",
        swimwearReasoning: null,
        swimwearRawSelectionText: null
      },
      rejectedUrls: []
    }
  }]);
});

test("regenerateCapsuleWardrobe uses profile llm=none instead of query flag", async () => {
  let generatedProfile = null;
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ audience: "woman", locale: "en", llm: "none" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })]
    }),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    generateCapsuleWardrobeImpl: async (profile) => {
      generatedProfile = profile;
      return buildWardrobeGenerationResult({
        items: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        selectedItems: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        promptEmbeddings: [0.1]
      });
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs: new Map(),
    randomUuidImpl: () => "req-no-llm"
  });
  const res = createResponseRecorder();

  await service.regenerateCapsuleWardrobe({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;
  assert.equal(generatedProfile.llm, "none");
});

test("getCapsuleItems surfaces failed job as service_unavailable and drops stale failed entry", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildWardrobeJobState({
      status: "failed",
      phase: "failed",
      updatedAt: Date.now(),
      error: Object.assign(new Error("failed"), { rawSelectionText: "llm raw" })
    })]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe(null),
    jobs
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: "service_unavailable",
    rawSelectionText: "llm raw"
  });
  assert.equal(jobs.has("person@example.com::capsule-1"), false);
});

test("startWardrobeJob reuses active pending job for the same email", async () => {
  let resolveGeneration;
  const pendingGeneration = new Promise<ReturnType<typeof buildWardrobeGenerationResult>>((resolve) => {
    resolveGeneration = resolve;
  });
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => pendingGeneration,
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    jobs: new Map()
  });

  const first = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ locale: "en" }),
    createCapsuleWithWardrobe(null)
  );
  const second = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ locale: "en" }),
    createCapsuleWithWardrobe(null)
  );

  assert.equal(first, second);

  resolveGeneration(buildWardrobeGenerationResult({
    items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
    selectedItems: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
    promptEmbeddings: [0.1]
  }));
  await first.promise;
});

test("startWardrobeJob stores capsule result and merges swimwear additions when enabled", async () => {
  const updates = [];
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult({
      items: [
        buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
        buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
        buildWardrobeUiItem({ id: "bottom-1", category: "bottom", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
        buildWardrobeUiItem({ id: "bag-1", category: "bag", url: undefined, name: undefined, image_url: undefined, audience: undefined })
      ],
      selectedItems: [
        buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
        buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
        buildWardrobeUiItem({ id: "bottom-1", category: "bottom", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
        buildWardrobeUiItem({ id: "bag-1", category: "bag", url: undefined, name: undefined, image_url: undefined, audience: undefined })
      ],
      promptEmbeddings: [0.1],
      outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
      reasoning: "capsule-json",
      rawSelectionText: "capsule-raw"
    }),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    shouldGenerateSwimwearImpl: () => true,
    generateSwimwearAdditionImpl: async () => ({
      items: [
        buildWardrobeUiItem({ id: "swim-1", category: "swimwear", url: "https://example.com/swim-1", name: "Swim 1", image_url: "https://example.com/swim-1.jpg", audience: "woman" }),
        buildWardrobeUiItem({ id: "top-1", category: "top", url: "https://example.com/top-1", name: "Top 1", image_url: "https://example.com/top-1.jpg", audience: "woman" })
      ],
      reasoning: "swimwear-json",
      rawSelectionText: "swimwear-raw"
    }),
    jobs: new Map()
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ audience: "woman", season: ["summer"], locale: "en" }),
    createCapsuleWithWardrobe(null)
  );
  await job.promise;

  assert.equal(job.status, "completed");
  assert.equal(job.phase, "completed");
  assert.deepEqual(updates, [
    ["person@example.com", "capsule-1", {
      filters: createCapsuleWithWardrobe().draft.filters,
      data: {
        wardrobe: {
          items: [
            buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "bottom-1", category: "bottom", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "bag-1", category: "bag", url: undefined, name: undefined, image_url: undefined, audience: undefined })
          ],
          outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
          reasoning: "capsule-json",
          rawSelectionText: "capsule-raw",
          swimwearReasoning: null,
          swimwearRawSelectionText: null
        },
        rejectedUrls: []
      }
    }],
    ["person@example.com", "capsule-1", {
      filters: createCapsuleWithWardrobe().draft.filters,
      data: {
        wardrobe: {
          items: [
            buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "bottom-1", category: "bottom", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "bag-1", category: "bag", url: undefined, name: undefined, image_url: undefined, audience: undefined }),
            buildWardrobeUiItem({ id: "swim-1", category: "swimwear", url: "https://example.com/swim-1", name: "Swim 1", image_url: "https://example.com/swim-1.jpg", audience: "woman" }),
            buildWardrobeUiItem({ id: "top-1", category: "top", url: "https://example.com/top-1", name: "Top 1", image_url: "https://example.com/top-1.jpg", audience: "woman" })
          ],
          outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }],
          reasoning: "capsule-json",
          rawSelectionText: "capsule-raw",
          swimwearReasoning: "swimwear-json",
          swimwearRawSelectionText: "swimwear-raw"
        },
        rejectedUrls: []
      }
    }]
  ]);
});

test("startWardrobeJob marks job failed when capsule generation returns no usable items", async () => {
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult(),
    jobs: new Map()
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    buildNormalizedProfileRecord({ audience: "woman", locale: "en" }),
    createCapsuleWithWardrobe(null)
  );
  await job.promise;

  assert.equal(job.status, "failed");
  assert.equal(job.phase, "failed");
  assert.match((job.error as Error).message, /no valid wardrobe items/i);
});
