import { test, expect } from "vitest";
import {
  createGenerateSwimwearAddition,
  getSwimwearPrompt,
  getSwimwearSystemPrompt,
  getSwimwearType,
  normalizeSwimwearSelection,
  shouldCompleteSelectedSwimwear,
  shouldGenerateSwimwear,
} from "./swimwear.js";
import type { SwimwearCandidate } from "./types.js";

test("shouldGenerateSwimwear returns true only when summer is present", () => {
  expect(shouldGenerateSwimwear({ season: ["spring"] })).toBe(false);
  expect(shouldGenerateSwimwear({ season: ["spring", "summer"] })).toBe(true);
  expect(shouldGenerateSwimwear({ season: "summer" })).toBe(true);
  expect(shouldGenerateSwimwear(null)).toBe(false);
});

test("getSwimwearPrompt renders YAML user message and keeps JSON unescaped", () => {
  const prompt = getSwimwearPrompt(
    [
      {
        id: "bottom-1",
        name: "Black & White Bottom",
        category: "bottom",
        color_base: ["black"],
        pattern: "solid",
      },
    ],
    [
      {
        id: "swim-1",
        name: "One <Piece>",
        swimwear_type: "swimsuit",
        color_base: ["black"],
        style: ["minimalistic"],
      },
    ],
  );

  expect(prompt).toMatch(/CAPSULE BOTTOMS/);
  expect(prompt).toMatch(/Black & White Bottom/);
  expect(prompt).toMatch(/One <Piece>/);
  expect(prompt).not.toMatch(/&amp;|&lt;|&gt;|\{\{/);
});

test("getSwimwearPrompt uses meaningful defaults for incomplete items", () => {
  const prompt = getSwimwearPrompt(
    [
      {
        category: "bottom",
        color_base: [],
      },
    ],
    [
      {
        id: null,
        name: null,
        swimwear_type: null,
        pattern: "   ",
        style: "sporty" as never,
        color_base: [],
      },
    ],
  );

  expect(prompt).toContain("Unnamed item");
  expect(prompt).toContain("ID: unknown");
  expect(prompt).toContain('"id": null');
  expect(prompt).toContain('"name": ""');
  expect(prompt).toContain('"swimwear_type": "swimsuit"');
  expect(prompt).toContain('"pattern": "solid"');
  expect(prompt).toContain('"style": []');
});

test("getSwimwearSystemPrompt returns the YAML system message", () => {
  expect(getSwimwearSystemPrompt()).toMatch(/expert AI fashion stylist/);
});

test("normalizeSwimwearSelection keeps a single swimsuit when swimsuit and extras are mixed", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimsuit" },
    { id: "2", swimwear_type: "swimwear_top" },
    { id: "3", swimwear_type: "swimwear_bottom" },
  ];

  expect(normalizeSwimwearSelection(["2", "1", "3"], candidates)).toEqual([
    { id: "1", swimwear_type: "swimsuit" },
  ]);
});

test("normalizeSwimwearSelection keeps a valid top and bottom pair", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
  ];

  expect(normalizeSwimwearSelection(["1", "2"], candidates)).toEqual(
    candidates,
  );
});

test("normalizeSwimwearSelection backfills missing bottom from ranked candidates", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
    { id: "3", swimwear_type: "swimsuit" },
  ];

  expect(normalizeSwimwearSelection(["1"], candidates)).toEqual([
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
  ]);
});

test("normalizeSwimwearSelection backfills missing top from ranked candidates", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
  ];

  expect(normalizeSwimwearSelection(["2"], candidates)).toEqual([
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
  ]);
});

test("normalizeSwimwearSelection returns empty array when pair cannot be completed", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
  ];

  expect(normalizeSwimwearSelection(["1"], candidates)).toEqual([]);
});

test("shouldCompleteSelectedSwimwear detects incomplete bikini swimwear", () => {
  expect(
    getSwimwearType({
      id: "legacy-bottom",
      category: "swimwear",
      name: "Swim Bottom",
    }),
  ).toBe("swimwear_bottom");
  expect(
    getSwimwearType({
      id: "legacy-one-piece",
      category: "swimwear",
      name: "Minimal One Piece",
    }),
  ).toBe("swimsuit");
  expect(
    getSwimwearType({
      id: "ambiguous-swimwear",
      category: "swimwear",
      name: "Resort Swimwear",
    }),
  ).toBe(null);
  expect(
    shouldCompleteSelectedSwimwear([
      {
        id: "bottom-1",
        category: "swimwear",
        swimwearType: "swimwear_bottom",
      } as never,
    ]),
  ).toBe(true);
  expect(
    shouldCompleteSelectedSwimwear([
      {
        id: "swimsuit-1",
        category: "swimwear",
        swimwearType: "swimsuit",
      } as never,
    ]),
  ).toBe(false);
  expect(
    shouldCompleteSelectedSwimwear([
      {
        id: "ambiguous-swimwear",
        category: "swimwear",
        name: "Resort Swimwear",
      } as never,
    ]),
  ).toBe(true);
});

test("generateSwimwearAddition skips non-summer profiles and selects male swimwear from SQL", async () => {
  const sqlCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl:
      () =>
      async (strings, ...values) => {
        sqlCalls.push({ strings, values });
        return [
          {
            id: "swim-1",
            url: "https://example.com/swim-1",
            name: "Swim Shorts",
            category: "swimwear",
            audience: "man",
            image_url: "https://example.com/swim-1.jpg",
            embedding: [1, 2],
            distance: 0.2,
          },
        ];
      },
  });

  const skipped = await generateSwimwearAddition({
    userProfile: { audience: "man", season: ["spring"] },
    selectedCapsuleItems: [],
    promptEmbeddings: [0.1, 0.2],
  });
  expect(skipped).toEqual({
    items: [],
    reasoning: null,
    rawSelectionText: null,
  });
  expect(sqlCalls.length).toBe(0);

  const result = await generateSwimwearAddition({
    userProfile: { audience: "man", season: ["summer"], style: "sporty" },
    selectedCapsuleItems: [
      { id: "top-1", category: "top", color_base: ["blue"] },
    ],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(sqlCalls.length).toBe(1);
  expect(result.items.length).toBe(1);
  expect(result.items[0]).toEqual({
    id: "swim-1",
    url: "https://example.com/swim-1",
    name: "Swim Shorts",
    category: "swimwear",
    imageUrl: "https://example.com/swim-1.jpg",
    audience: "man",
  });
});

test("generateSwimwearAddition skips SQL when the capsule already has swimwear", async () => {
  const sqlCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl:
      () =>
      async (...args) => {
        sqlCalls.push(args);
        return [];
      },
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"] },
    selectedCapsuleItems: [
      {
        id: "swim-existing",
        category: "swimwear",
        swimwearType: "swimsuit",
      } as never,
    ],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(result).toEqual({
    items: [],
    reasoning: null,
    rawSelectionText: null,
  });
  expect(sqlCalls).toEqual([]);
});

test("generateSwimwearAddition treats ambiguous legacy swimwear as full replacement", async () => {
  const sqlCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl:
      () =>
      async (...args) => {
        sqlCalls.push(args);
        return [
          {
            id: "swimsuit-1",
            name: "Minimal Swimsuit",
            category: "swimwear",
            swimwear_type: "swimsuit",
            audience: "woman",
            url: "https://example.com/swimsuit",
          },
        ];
      },
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["winter"] },
    selectedCapsuleItems: [
      {
        id: "legacy-swimwear",
        category: "swimwear",
        name: "Resort Swimwear",
      } as never,
    ],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(sqlCalls).toHaveLength(1);
  expect(result.items).toEqual([
    {
      id: "swimsuit-1",
      url: "https://example.com/swimsuit",
      name: "Minimal Swimsuit",
      category: "swimwear",
      imageUrl: "",
      audience: "woman",
      swimwearType: "swimsuit",
    },
  ]);
});

test("generateSwimwearAddition completes a bikini counterpart outside summer", async () => {
  const sqlCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl:
      () =>
      async (...args) => {
        sqlCalls.push(args);
        return [
          {
            id: "top-1",
            name: "Bikini Top",
            category: "swimwear",
            swimwear_type: "swimwear_top",
            audience: "woman",
            url: "https://example.com/top",
          },
          {
            id: "swimsuit-1",
            name: "One Piece",
            category: "swimwear",
            swimwear_type: "swimsuit",
            audience: "woman",
            url: "https://example.com/swimsuit",
          },
        ];
      },
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["winter"] },
    selectedCapsuleItems: [
      {
        id: "bottom-1",
        category: "swimwear",
        swimwearType: "swimwear_bottom",
        colorBase: ["black"],
      } as never,
    ],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(sqlCalls).toHaveLength(1);
  expect(result.items).toEqual([
    {
      id: "top-1",
      url: "https://example.com/top",
      name: "Bikini Top",
      category: "swimwear",
      imageUrl: "",
      audience: "woman",
      swimwearType: "swimwear_top",
    },
  ]);
});

test("generateSwimwearAddition keeps wardrobe metadata for one male wardrobe swimwear item", async () => {
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => [
      {
        id: "W7",
        item_source: "wardrobe",
        source: "uploaded",
        raw_image_url: "https://example.com/raw.jpg",
        processing_status: "ready",
        wardrobe_id: "7",
        name: "Swim Shorts",
        category: "swimwear",
        audience: "man",
        url: "wardrobe://7",
      },
    ],
  });

  const result = await generateSwimwearAddition({
    userProfile: {
      email: "person@example.com",
      audience: "man",
      season: ["summer"],
      sourceMode: "wardrobe_only",
    },
    selectedCapsuleItems: [],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(result.items).toEqual([
    {
      id: "W7",
      url: "wardrobe://7",
      name: "Swim Shorts",
      category: "swimwear",
      imageUrl: "",
      audience: "man",
      itemSource: "wardrobe",
      source: "uploaded",
      rawImageUrl: "https://example.com/raw.jpg",
      processingStatus: "ready",
      wardrobeId: "7",
    },
  ]);
});

test("generateSwimwearAddition selects the only female bikini pair without LLM", async () => {
  const llmCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => [
      {
        id: "top-1",
        name: "Bikini Top",
        category: "swimwear",
        swimwear_type: "swimwear_top",
        audience: "woman",
        url: "https://example.com/top",
      },
      {
        id: "bottom-1",
        name: "Bikini Bottom",
        category: "swimwear",
        swimwear_type: "swimwear_bottom",
        audience: "woman",
        url: "https://example.com/bottom",
      },
    ],
    getGenerateJsonWithLlmImpl:
      () =>
      async (...args) => {
        llmCalls.push(args);
        return { response: {}, json: {} };
      },
    isNoLlmProfileEnabledImpl: () => false,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
    }),
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"] },
    selectedCapsuleItems: [
      { id: "bottom-capsule", category: "bottom", color_base: ["black"] },
    ],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(result.items.map((item) => item.id)).toEqual(["top-1", "bottom-1"]);
  expect(result.reasoning).toBe(null);
  expect(result.rawSelectionText).toBe(null);
  expect(llmCalls).toEqual([]);
});

test("generateSwimwearAddition selects the only female swimsuit without LLM", async () => {
  const llmCalls = [];
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => [
      {
        id: "swimsuit-1",
        name: "Minimal Swimsuit",
        category: "swimwear",
        swimwear_type: "swimsuit",
        audience: "woman",
        url: "https://example.com/swimsuit",
      },
    ],
    getGenerateJsonWithLlmImpl:
      () =>
      async (...args) => {
        llmCalls.push(args);
        return { response: {}, json: {} };
      },
    isNoLlmProfileEnabledImpl: () => false,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
    }),
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"] },
    selectedCapsuleItems: [],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(result.items.map((item) => item.id)).toEqual(["swimsuit-1"]);
  expect(llmCalls).toEqual([]);
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
        url: "https://example.com/swimsuit",
      },
      {
        id: "swimsuit-2",
        name: "Sport Swimsuit",
        category: "swimwear",
        swimwear_type: "swimsuit",
        audience: "woman",
        url: "https://example.com/swimsuit-2",
      },
    ],
    getGenerateJsonWithLlmImpl: () => async (prompt, options) => {
      llmCalls.push({ prompt, options });
      return {
        response: {
          output_text: " Raw text ",
          usage: { input_tokens: 5, output_tokens: 3 },
        },
        json: {
          swimwear: ["swimsuit-1"],
          _reasoning: " Best color match ",
        },
      };
    },
    isNoLlmProfileEnabledImpl: () => false,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
      fallbackReason: null,
    }),
  });

  const result = await generateSwimwearAddition({
    userProfile: {
      audience: "woman",
      season: ["summer"],
      style: "minimalistic",
    },
    selectedCapsuleItems: [
      {
        id: "bottom-capsule",
        name: "Black Bottom",
        category: "bottom",
        color_base: ["black"],
      },
    ],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(llmCalls.length).toBe(1);
  expect(llmCalls[0].prompt).toMatch(/Minimal Swimsuit/);
  expect(llmCalls[0].options.systemPrompt).toBe(getSwimwearSystemPrompt());
  expect(result.items.map((item) => item.id)).toEqual(["swimsuit-1"]);
  expect(result.reasoning).toBe("Best color match");
  expect(result.rawSelectionText).toBe("Raw text");
});

test("generateSwimwearAddition returns empty result when female SQL has no candidates", async () => {
  const generateSwimwearAddition = createGenerateSwimwearAddition({
    getSqlClientImpl: () => async () => [],
  });

  const result = await generateSwimwearAddition({
    userProfile: { audience: "woman", season: ["summer"] },
    selectedCapsuleItems: [],
    promptEmbeddings: [0.1, 0.2],
  });

  expect(result).toEqual({
    items: [],
    reasoning: null,
    rawSelectionText: null,
  });
});
