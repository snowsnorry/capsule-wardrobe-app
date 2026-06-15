import { describe, expect, test, vi } from "vitest";
import { generateOutfitReport } from "./outfitReportService.js";

const outfitItems = [
  { url: "https://example.com/top", source: "from_catalog" },
  { url: "wardrobe://bottom", source: "uploaded" },
];
const hydratedItems = [
  {
    id: "catalog-top-1",
    source: "from_catalog",
    url: "https://example.com/top",
    name: "White shirt",
    category: "top",
    imageUrl: "https://images.example.com/top.jpg",
    colorBase: ["white"],
    formalityLevel: ["smart_casual"],
    style: ["minimalistic"],
  },
  {
    id: "18",
    source: "uploaded",
    url: "wardrobe://bottom",
    name: "Blue jeans",
    category: "bottom",
    imageUrl: "https://images.example.com/bottom.jpg",
    colorBase: ["blue"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
  },
];
const outfit = {
  id: "outfit-1",
  draft: { items: outfitItems, image: null, imageObsolete: false },
  saved: null,
};
const userProfile = { llm: "openai:gpt-5.5" };

function buildLlmReport(overrides = {}) {
  return {
    verdict: {
      status: "incomplete",
      score: 0.58,
      summary: "The outfit needs footwear before it is complete.",
    },
    composition: {
      itemCount: 2,
      categoryCounts: {
        top: 1,
        bottom: 1,
        midlayer: 0,
        outerwear: 0,
        dress: 0,
        shoes: 0,
        bag: 0,
        belt: 0,
        swimwear: 0,
        other: 0,
      },
      detectedRoles: ["base_top", "bottom"],
      missingCoreRoles: ["footwear"],
      extraRoles: [],
      completeness: "partial",
    },
    seasonality: {
      primarySeasons: ["spring"],
      secondarySeasons: ["autumn"],
      temperatureBandC: { min: 12, max: 22 },
      weatherSuitability: ["dry", "cool"],
      weatherLimitations: [],
      seasonScore: 0.8,
    },
    styleProfile: {
      primaryStyle: "minimalistic",
      secondaryStyles: [],
      formalityLevel: "casual",
      occasions: ["everyday_errands"],
      styleKeywords: ["clean", "relaxed"],
      styleScore: 0.76,
    },
    compatibility: {
      overallScore: 0.7,
      styleCoherence: 0.8,
      formalityCoherence: 0.75,
      seasonalCoherence: 0.8,
      colorCoherence: 0.85,
      mainStrengths: ["The colors are easy to pair."],
      mainRisks: ["Footwear is missing."],
    },
    colorAnalysis: {
      paletteType: "neutral",
      dominantColors: ["white", "blue"],
      accentColors: [],
      contrastLevel: "medium",
      harmony: "cohesive",
      colorScore: 0.86,
      notes: "The palette is simple and wearable.",
    },
    issues: [
      {
        code: "MISSING_FOOTWEAR",
        severity: "critical",
        dimension: "composition",
        message: "The outfit has no footwear.",
        affectedItemIds: ["W18"],
        suggestion: "Add casual shoes to complete the look.",
      },
    ],
    suggestions: [
      {
        type: "add",
        priority: "high",
        targetItemIds: ["W18"],
        replacementCategory: "shoes",
        replacementDescription: "clean white sneakers",
        message: "Add clean sneakers to finish the outfit.",
      },
    ],
    confidence: {
      overall: 0.82,
      lowConfidenceAspects: ["exact_fit"],
      assumptions: ["The items are assessed from flat product images."],
    },
    ...overrides,
  };
}

function createDeps({
  llmJson = buildLlmReport(),
  outfitValue = outfit,
  items = hydratedItems,
  llmError = null,
}: {
  llmJson?: unknown;
  outfitValue?: Record<string, unknown> | null;
  items?: unknown[];
  llmError?: Error | null;
} = {}) {
  const generateJsonWithLlm = vi.fn(async () => {
    if (llmError) {
      throw llmError;
    }
    return { response: { usage: { total_tokens: 42 } }, json: llmJson };
  });
  const updateOutfitReportImpl = vi.fn(async () =>
    outfitValue ? { ...outfitValue } : null,
  );

  return {
    buildPromptDebugImagesForCategoryImpl: vi.fn(async () => ({
      category: {
        category: "Current Outfit",
        buffer: Buffer.from("current-outfit"),
        cachedCount: 0,
        downloadedCount: 1,
        mimeType: "image/jpeg",
        filename: "category-current-outfit.jpg",
      },
    })),
    getGenerateJsonWithLlmImpl: vi.fn(() => generateJsonWithLlm),
    getOutfitImpl: vi.fn(async () => outfitValue),
    getOutfitItemsImpl: vi.fn(async () => items),
    getProfileImpl: vi.fn(async () => userProfile),
    hashItemsImpl: vi.fn(() => "items-hash"),
    resolveLlmProviderImpl: vi.fn(() => ({
      provider: "openai",
      model: "gpt-5.5",
      requestedLlm: "openai:gpt-5.5",
    })),
    runWithImageWorkSlotImpl: vi.fn(async (_label, work) => work()),
    saveLastPromptArtifactsImpl: vi.fn(),
    updateOutfitReportImpl,
    generateJsonWithLlm,
  };
}

describe("generateOutfitReport", () => {
  test("generates, validates, computes score, and persists a report with server metadata", async () => {
    const deps = createDeps({
      llmJson: buildLlmReport({
        verdict: {
          status: "incomplete",
          score: 0.99,
          summary: "The outfit needs footwear before it is complete.",
        },
      }),
    });

    await expect(
      generateOutfitReport("person@example.com", "outfit-1", deps),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      itemsHash: "items-hash",
      verdict: {
        llmScore: 0.99,
        llmStatus: "incomplete",
        score: 0.58,
        status: "incomplete",
      },
    });
    expect(deps.buildPromptDebugImagesForCategoryImpl).toHaveBeenCalledWith({
      category: "Current Outfit",
      compactRows: true,
      items: [
        {
          id: "catalog-top-1",
          category: "top",
          imageUrl: "https://images.example.com/top.jpg",
        },
        {
          id: "W18",
          category: "bottom",
          imageUrl: "https://images.example.com/bottom.jpg",
        },
      ],
    });
    expect(deps.generateJsonWithLlm).toHaveBeenCalledWith(
      expect.stringContaining('"id": "catalog-top-1"'),
      expect.objectContaining({
        format: expect.objectContaining({ name: "outfit_report" }),
        images: [
          expect.objectContaining({
            buffer: Buffer.from("current-outfit"),
            category: "Current Outfit",
            filename: "current-outfit.jpg",
            mimeType: "image/jpeg",
          }),
        ],
        systemPrompt: expect.stringContaining("outfit-report-auditor"),
      }),
    );
    expect(deps.generateJsonWithLlm).toHaveBeenCalledWith(
      expect.stringContaining('"id": "W18"'),
      expect.any(Object),
    );
    expect(deps.saveLastPromptArtifactsImpl).toHaveBeenCalledWith({
      prompt: expect.stringContaining('"id": "catalog-top-1"'),
      userProfile,
      systemPrompt: expect.stringContaining("outfit-report-auditor"),
      currentOutfitCollage: expect.objectContaining({
        buffer: Buffer.from("current-outfit"),
        category: "Current Outfit",
        filename: "current-outfit.jpg",
      }),
    });
    expect(deps.saveLastPromptArtifactsImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('"id": "W18"'),
      }),
    );
    expect(deps.updateOutfitReportImpl).toHaveBeenCalledWith(
      "person@example.com",
      "outfit-1",
      expect.objectContaining({
        schemaVersion: 1,
        itemsHash: "items-hash",
        verdict: expect.objectContaining({
          llmScore: 0.99,
          llmStatus: "incomplete",
          score: 0.58,
          status: "incomplete",
        }),
      }),
    );
  });

  test("reports missing outfit and empty outfit as domain errors", async () => {
    await expect(
      generateOutfitReport("person@example.com", "missing", {
        ...createDeps({ outfitValue: null }),
      }),
    ).rejects.toMatchObject({ code: "not_found" });

    await expect(
      generateOutfitReport("person@example.com", "outfit-1", {
        ...createDeps({
          outfitValue: { id: "outfit-1", draft: { items: [] }, saved: null },
          items: [],
        }),
      }),
    ).rejects.toMatchObject({ code: "invalid_payload" });
  });

  test("rejects unresolved items and items without exact ids", async () => {
    await expect(
      generateOutfitReport("person@example.com", "outfit-1", {
        ...createDeps({ items: [hydratedItems[0]] }),
      }),
    ).rejects.toMatchObject({ code: "invalid_payload" });

    await expect(
      generateOutfitReport("person@example.com", "outfit-1", {
        ...createDeps({
          items: [{ ...hydratedItems[0], id: "" }, hydratedItems[1]],
        }),
      }),
    ).rejects.toMatchObject({ code: "invalid_payload" });
  });

  test("maps LLM and invalid structured output failures to service unavailable", async () => {
    await expect(
      generateOutfitReport("person@example.com", "outfit-1", {
        ...createDeps({ llmError: new Error("llm_failed") }),
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });

    await expect(
      generateOutfitReport("person@example.com", "outfit-1", {
        ...createDeps({
          llmJson: buildLlmReport({
            issues: [
              {
                code: "BAD_ID",
                severity: "warning",
                dimension: "style",
                message: "Bad id.",
                affectedItemIds: ["invented-id"],
                suggestion: "Ignore it.",
              },
            ],
          }),
        }),
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });

    await expect(
      generateOutfitReport("person@example.com", "outfit-1", {
        ...createDeps({
          llmJson: buildLlmReport({
            composition: {
              ...buildLlmReport().composition,
              categoryCounts: {
                ...buildLlmReport().composition.categoryCounts,
                top: -1,
                bottom: 3,
              },
            },
          }),
        }),
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });
  });
});
