import test from "node:test";
import assert from "node:assert/strict";
import {
  createGenerateSwimwearAddition,
  getSwimwearPrompt,
  getSwimwearSystemPrompt,
  normalizeSwimwearSelection,
  shouldGenerateSwimwear
} from "./swimwear.js";
import type { SwimwearCandidate } from "./types.js";

test("shouldGenerateSwimwear returns true only when summer is present", () => {
  assert.equal(shouldGenerateSwimwear({ season: ["spring"] }), false);
  assert.equal(shouldGenerateSwimwear({ season: ["spring", "summer"] }), true);
  assert.equal(shouldGenerateSwimwear({ season: "summer" }), true);
  assert.equal(shouldGenerateSwimwear(null), false);
});

test("getSwimwearPrompt renders YAML user message and keeps JSON unescaped", () => {
  const prompt = getSwimwearPrompt(
    [{ id: "bottom-1", name: "Black & White Bottom", category: "bottom", color_base: ["black"], pattern: "solid" }],
    [{ id: "swim-1", name: "One <Piece>", swimwear_type: "swimsuit", color_base: ["black"], style: ["minimalistic"] }]
  );

  assert.match(prompt, /CAPSULE BOTTOMS/);
  assert.match(prompt, /Black & White Bottom/);
  assert.match(prompt, /One <Piece>/);
  assert.doesNotMatch(prompt, /&amp;|&lt;|&gt;|\{\{/);
});

test("getSwimwearSystemPrompt returns the YAML system message", () => {
  assert.match(getSwimwearSystemPrompt(), /expert AI fashion stylist/);
});

test("normalizeSwimwearSelection keeps a single swimsuit when swimsuit and extras are mixed", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimsuit" },
    { id: "2", swimwear_type: "swimwear_top" },
    { id: "3", swimwear_type: "swimwear_bottom" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["2", "1", "3"], candidates),
    [{ id: "1", swimwear_type: "swimsuit" }]
  );
});

test("normalizeSwimwearSelection keeps a valid top and bottom pair", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["1", "2"], candidates),
    candidates
  );
});

test("normalizeSwimwearSelection backfills missing bottom from ranked candidates", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
    { id: "3", swimwear_type: "swimsuit" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["1"], candidates),
    [
      { id: "1", swimwear_type: "swimwear_top" },
      { id: "2", swimwear_type: "swimwear_bottom" }
    ]
  );
});

test("normalizeSwimwearSelection backfills missing top from ranked candidates", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["2"], candidates),
    [
      { id: "1", swimwear_type: "swimwear_top" },
      { id: "2", swimwear_type: "swimwear_bottom" }
    ]
  );
});

test("normalizeSwimwearSelection returns empty array when pair cannot be completed", () => {
  const candidates: SwimwearCandidate[] = [{ id: "1", swimwear_type: "swimwear_top" }];

  assert.deepEqual(normalizeSwimwearSelection(["1"], candidates), []);
});

test("generateSwimwearAddition skips non-summer profiles and selects male swimwear from SQL", async () => {
  const sqlCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async (strings, ...values) => {
      sqlCalls.push({ strings, values });
      return [{
        id: "swim-1",
        url: "https://example.com/swim-1",
        name: "Swim Shorts",
        category: "swimwear",
        audience: "man",
        image_url: "https://example.com/swim-1.jpg",
        embedding: [1, 2],
        distance: 0.2
      }];
    }
  });

  const skipped = await generateSwimwearAddition({
    userProfile: { audience: "man", season: ["spring"] },
    selectedCapsuleItems: [],
    promptEmbeddings: [0.1, 0.2]
  });
  assert.deepEqual(skipped, { items: [], reasoning: null, rawSelectionText: null });
  assert.equal(sqlCalls.length, 0);

  const result = await generateSwimwearAddition({
    userProfile: { audience: "man", season: ["summer"], style: "sporty" },
    selectedCapsuleItems: [{ id: "top-1", category: "top", color_base: ["blue"] }],
    promptEmbeddings: [0.1, 0.2]
  });

  assert.equal(sqlCalls.length, 1);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    id: "swim-1",
    url: "https://example.com/swim-1",
    name: "Swim Shorts",
    category: "swimwear",
    image_url: "https://example.com/swim-1.jpg",
    audience: "man"
  });
});

test("generateSwimwearAddition selects female swimwear without LLM when profile disables models", async () => {
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => [
      {
        id: "top-1",
        name: "Bikini Top",
        category: "swimwear",
        swimwear_type: "swimwear_top",
        audience: "woman",
        url: "https://example.com/top"
      },
      {
        id: "bottom-1",
        name: "Bikini Bottom",
        category: "swimwear",
        swimwear_type: "swimwear_bottom",
        audience: "woman",
        url: "https://example.com/bottom"
      }
    ],
    isNoLlmProfileEnabledImpl: () => true,
    resolveLlmProviderImpl: () => ({ requestedLlm: "none", provider: "none", model: null })
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"], llm: "none" },
    selectedCapsuleItems: [{ id: "bottom-capsule", category: "bottom", color_base: ["black"] }],
    promptEmbeddings: [0.1, 0.2]
  });

  assert.deepEqual(result.items.map((item) => item.id), ["top-1", "bottom-1"]);
  assert.equal(result.reasoning, null);
  assert.equal(result.rawSelectionText, null);
});

test("generateSwimwearAddition uses LLM selection and preserves reasoning text for female profiles", async () => {
  const llmCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => [
      {
        id: "swimsuit-1",
        name: "Minimal Swimsuit",
        category: "swimwear",
        swimwear_type: "swimsuit",
        audience: "woman",
        url: "https://example.com/swimsuit"
      }
    ],
    getGenerateJsonWithLlmImpl: () => async (prompt, options) => {
      llmCalls.push({ prompt, options });
      return {
        response: {
          output_text: " Raw text ",
          usage: { input_tokens: 5, output_tokens: 3 }
        },
        json: {
          swimwear: ["swimsuit-1"],
          _reasoning: " Best color match "
        }
      };
    },
    isNoLlmProfileEnabledImpl: () => false,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
      fallbackReason: null
    })
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"], style: "minimalistic" },
    selectedCapsuleItems: [{ id: "bottom-capsule", name: "Black Bottom", category: "bottom", color_base: ["black"] }],
    promptEmbeddings: [0.1, 0.2]
  });

  assert.equal(llmCalls.length, 1);
  assert.match(llmCalls[0].prompt, /Minimal Swimsuit/);
  assert.equal(llmCalls[0].options.systemPrompt, getSwimwearSystemPrompt());
  assert.deepEqual(result.items.map((item) => item.id), ["swimsuit-1"]);
  assert.equal(result.reasoning, "Best color match");
  assert.equal(result.rawSelectionText, "Raw text");
});

test("generateSwimwearAddition returns empty result when female SQL has no candidates", async () => {
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => []
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"] },
    selectedCapsuleItems: [],
    promptEmbeddings: [0.1, 0.2]
  });

  assert.deepEqual(result, { items: [], reasoning: null, rawSelectionText: null });
});
