import { describe, expect, test, vi } from "vitest";
import { generateCapsuleReport } from "./capsuleReportService.js";

const capsuleItems = [
  {
    id: "catalog-top-1",
    source: "from_catalog",
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
    wardrobeId: "18",
    name: "Blue jeans",
    category: "bottom",
    imageUrl: "https://images.example.com/bottom.jpg",
    colorBase: ["blue"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
  },
];

const capsule = {
  id: "capsule-1",
  draft: {
    filters: {
      formalityLevel: "smart_casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: "red",
      pattern: "striped",
      text: "Prefer natural fabrics.",
      sourceMode: "wardrobe_preferred",
      anchorItemRefs: [],
    },
    data: {
      wardrobe: {
        items: capsuleItems,
        outfitSets: [{ itemIds: ["catalog-top-1", "18"] }],
      },
      rejectedUrls: [],
    },
  },
  saved: null,
};

const userProfile = { llm: "openai:gpt-5.5" };

function buildLlmReport(overrides = {}) {
  return {
    verdict: {
      status: "good",
      score: 0.86,
      summary: "The capsule is cohesive and suitable for the target.",
    },
    capsuleSummary: {
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
      detectedCategoryBalance: "balanced",
      capsuleType: "minimal",
      summaryTags: ["Office", "Minimal"],
    },
    targetAlignment: {
      overallScore: 0.86,
      audienceFit: { score: 0.9, verdict: "strong", notes: "Aligned." },
      occasionFit: {
        score: 0.86,
        matchedOccasions: ["office"],
        weakOccasions: [],
        notes: "Office is supported.",
      },
      formalityFit: {
        score: 0.82,
        detectedRange: ["smart_casual"],
        targetMatched: true,
        notes: "Matches.",
      },
      styleFit: {
        score: 0.88,
        primaryDetectedStyle: "minimalistic",
        secondaryDetectedStyles: [],
        targetMatched: true,
        notes: "Clean.",
      },
      accentColorFit: {
        score: 0.7,
        targetAccentColor: "red",
        presentAs: "minor_detail",
        notes: "Red is limited.",
      },
      patternFit: {
        score: 0.8,
        targetPattern: "striped",
        verdict: "compatible",
        notes: "Pattern use is controlled.",
      },
      additionalInfoFit: {
        score: 0.9,
        interpretedRequirements: ["Prefer natural fabrics."],
        unmetRequirements: [],
        notes: "Additional info is satisfied.",
      },
    },
    coverage: {
      overallScore: 0.7,
      coreRoleCoverage: {
        tops: "adequate",
        bottoms: "adequate",
        shoes: "thin",
        layers: "missing",
        accessories: "missing",
      },
      missingCategories: [],
      weakCategories: ["shoes"],
      overrepresentedCategories: [],
      bottlenecks: [],
      notes: "Footwear is not present in the tiny capsule.",
    },
    versatility: {
      overallScore: 0.76,
      mixAndMatchScore: 0.74,
      repeatabilityScore: 0.78,
      outfitVariety: "moderate",
      primaryOutfitModes: ["office", "minimal"],
      limitingFactors: ["Only one generated outfit was provided."],
      notes: "Small but usable.",
    },
    cohesion: {
      overallScore: 0.9,
      styleCoherence: 0.92,
      formalityCoherence: 0.86,
      silhouetteCoherence: 0.85,
      materialCoherence: 0.8,
      colorCoherence: 0.88,
      mainStrengths: ["Simple palette."],
      mainRisks: [],
      notes: "The items are cohesive.",
    },
    seasonality: {
      overallScore: 0.82,
      primarySeasons: ["spring"],
      secondarySeasons: ["autumn"],
      temperatureBandC: { min: 12, max: 22 },
      layeringSupport: "limited",
      weatherSuitability: ["dry", "cool"],
      weatherLimitations: [],
      notes: "Best in mild weather.",
    },
    colorAnalysis: {
      paletteType: "neutral",
      baseColors: ["white", "blue"],
      accentColors: ["red"],
      targetAccentColor: "red",
      accentColorUsage: "subtle",
      contrastLevel: "medium",
      harmony: "cohesive",
      colorScore: 0.88,
      notes: "The palette is wearable.",
    },
    generatedOutfitAssessment: {
      providedOutfitCount: 1,
      overallScore: 0.8,
      completeOutfitCount: 1,
      weakOutfitCount: 0,
      varietyScore: 0.65,
      targetFitScore: 0.83,
      roleCoverageScore: 0.78,
      repetitionScore: 0.8,
      strongestOutfitRefs: ["outfit-set-1"],
      weakOutfits: [],
      notes: "The provided outfit works.",
    },
    issues: [
      {
        code: "LIMITED_LAYERING",
        severity: "info",
        dimension: "coverage",
        message: "The capsule has little layering support.",
        affectedItemIds: ["W18"],
        suggestion: "Consider a light layer if weather requires it.",
      },
    ],
    suggestions: [
      {
        type: "add",
        priority: "medium",
        targetItemIds: [],
        targetCategory: "midlayer",
        replacementCategory: "midlayer",
        replacementDescription: "light neutral cardigan",
        expectedImpact: "improve_seasonality",
        message: "Add one light layer for transitional weather.",
      },
    ],
    confidence: {
      overall: 0.8,
      lowConfidenceAspects: ["exact_fit"],
      assumptions: ["The items are assessed from product images."],
    },
    ...overrides,
  };
}

function createDeps({
  capsuleValue = capsule,
  llmError = null,
  llmJson = buildLlmReport(),
}: {
  capsuleValue?: Record<string, unknown> | null;
  llmError?: Error | null;
  llmJson?: unknown;
} = {}) {
  const generateJsonWithLlm = vi.fn(
    async (_prompt: string, _options: Record<string, unknown>) => {
      if (llmError) {
        throw llmError;
      }
      return { response: { usage: { total_tokens: 42 } }, json: llmJson };
    },
  );
  const updateCapsuleReportImpl = vi.fn(async () =>
    capsuleValue ? { ...capsuleValue } : null,
  );

  return {
    buildPromptDebugImagesForCategoryImpl: vi.fn(async () => ({
      category: {
        category: "Current Capsule",
        buffer: Buffer.from("current-capsule"),
        mimeType: "image/jpeg",
        filename: "category-current-capsule.jpg",
      },
    })),
    generateJsonWithLlm,
    getCapsuleImpl: vi.fn(async () => capsuleValue),
    getGenerateJsonWithLlmImpl: vi.fn(() => generateJsonWithLlm),
    getProfileImpl: vi.fn(async () => userProfile),
    hashItemsImpl: vi.fn(() => "capsule-report-hash"),
    resolveLlmProviderImpl: vi.fn(() => ({
      provider: "openai",
      model: "gpt-5.5",
      requestedLlm: "openai:gpt-5.5",
    })),
    runWithImageWorkSlotImpl: vi.fn(async (_label, work) => work()),
    saveLastPromptArtifactsImpl: vi.fn(),
    updateCapsuleReportImpl,
  };
}

describe("generateCapsuleReport", () => {
  test("generates, validates, scores, and persists a capsule report", async () => {
    const deps = createDeps({
      llmJson: buildLlmReport({
        verdict: {
          status: "good",
          score: 0.91,
          summary: "The capsule is cohesive and suitable for the target.",
        },
      }),
    });

    await expect(
      generateCapsuleReport("person@example.com", "capsule-1", deps),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      itemsHash: "capsule-report-hash",
      verdict: { llmScore: 0.91, score: 0.78, status: "good" },
    });
    expect(deps.buildPromptDebugImagesForCategoryImpl).toHaveBeenCalledWith({
      category: "Current Capsule",
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
      expect.stringContaining("Audience: woman"),
      expect.objectContaining({
        format: expect.objectContaining({ name: "capsule_report" }),
        images: [
          expect.objectContaining({
            buffer: Buffer.from("current-capsule"),
            category: "Current Capsule",
            filename: "current-capsule.jpg",
            mimeType: "image/jpeg",
          }),
        ],
        systemPrompt: expect.stringContaining("capsule-report-auditor"),
      }),
    );
    const prompt = deps.generateJsonWithLlm.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("Seasons: spring");
    expect(prompt).toContain("Target Formality: smart_casual");
    expect(prompt).toContain("Important Additional Information");
    expect(prompt).toContain('"id": "catalog-top-1"');
    expect(prompt).toContain('"id": "W18"');
    expect(prompt).toContain('"id": "outfit-set-1"');
    expect(prompt).toContain('"itemIds": [');
    expect(prompt).toContain('"catalog-top-1"');
    expect(deps.saveLastPromptArtifactsImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        currentCapsuleCollage: expect.objectContaining({
          buffer: Buffer.from("current-capsule"),
          category: "Current Capsule",
          filename: "current-capsule.jpg",
        }),
        prompt: expect.stringContaining('"id": "outfit-set-1"'),
        systemPrompt: expect.stringContaining("capsule-report-auditor"),
        userProfile,
      }),
    );
    expect(deps.hashItemsImpl).toHaveBeenCalledWith({
      filters: capsule.draft.filters,
      generatedOutfits: [
        { id: "outfit-set-1", itemIds: ["catalog-top-1", "W18"] },
      ],
      items: [
        expect.objectContaining({ id: "catalog-top-1" }),
        expect.objectContaining({ id: "W18" }),
      ],
    });
    expect(deps.updateCapsuleReportImpl).toHaveBeenCalledWith(
      "person@example.com",
      "capsule-1",
      expect.objectContaining({
        schemaVersion: 1,
        itemsHash: "capsule-report-hash",
        verdict: expect.objectContaining({ llmScore: 0.91, score: 0.78 }),
      }),
    );
  });

  test("renders a no-generated-outfits message when capsule has no outfit sets", async () => {
    const deps = createDeps({
      capsuleValue: {
        ...capsule,
        draft: {
          ...capsule.draft,
          data: {
            ...capsule.draft.data,
            wardrobe: { items: capsuleItems, outfitSets: [] },
          },
        },
      },
      llmJson: buildLlmReport({
        generatedOutfitAssessment: {
          ...buildLlmReport().generatedOutfitAssessment,
          providedOutfitCount: 0,
          completeOutfitCount: 0,
          weakOutfitCount: 0,
          strongestOutfitRefs: [],
          weakOutfits: [],
        },
      }),
    });

    await generateCapsuleReport("person@example.com", "capsule-1", deps);

    expect(deps.generateJsonWithLlm.mock.calls[0]?.[0]).toContain(
      "No generated outfit sets were provided for this capsule.",
    );
  });

  test("reports missing, empty, unresolved, and failed reports as domain errors", async () => {
    await expect(
      generateCapsuleReport("person@example.com", "missing", {
        ...createDeps({ capsuleValue: null }),
      }),
    ).rejects.toMatchObject({ code: "not_found" });

    await expect(
      generateCapsuleReport("person@example.com", "capsule-1", {
        ...createDeps({
          capsuleValue: {
            ...capsule,
            draft: { ...capsule.draft, data: { wardrobe: { items: [] } } },
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "invalid_payload" });

    await expect(
      generateCapsuleReport("person@example.com", "capsule-1", {
        ...createDeps({
          capsuleValue: {
            ...capsule,
            draft: {
              ...capsule.draft,
              data: {
                ...capsule.draft.data,
                wardrobe: {
                  items: capsuleItems,
                  outfitSets: [{ itemIds: ["missing-item"] }],
                },
              },
            },
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "invalid_payload" });

    await expect(
      generateCapsuleReport("person@example.com", "capsule-1", {
        ...createDeps({ llmError: new Error("llm_failed") }),
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });
  });

  test("maps invalid structured output to service unavailable", async () => {
    await expect(
      generateCapsuleReport("person@example.com", "capsule-1", {
        ...createDeps({
          llmJson: buildLlmReport({
            generatedOutfitAssessment: {
              ...buildLlmReport().generatedOutfitAssessment,
              strongestOutfitRefs: ["invented-outfit"],
            },
          }),
        }),
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });
  });
});
