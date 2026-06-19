import { describe, expect, test, vi } from "vitest";
import {
  generatePersonalItemsReport,
  getPersonalItemUrls,
} from "./personalItemsReportService.js";
import {
  applyComputedPersonalItemsVerdictScore,
  computeVerdictScore,
} from "./personalItemsReportScoring.js";
import { parsePersonalItemsReportLlmOutput } from "./personalItemsReportValidation.js";
import type { PersonalItemsReportLlmOutput } from "./personalItemsReportTypes.js";
import {
  buildPersonalItemsReportError,
  isPersonalItemsReportDomainError,
} from "./personalItemsReportErrors.js";

const wardrobeItems = [
  {
    id: "2",
    source: "from_catalog",
    url: "https://example.com/jeans",
    name: "Straight jeans",
    category: "bottom",
    imageUrl: "https://images.example.com/jeans.jpg",
    colorBase: ["blue"],
    season: ["spring"],
    style: ["minimalistic"],
  },
  {
    id: "1",
    source: "uploaded",
    url: "wardrobe://1",
    name: "White tee",
    category: "top",
    imageUrl: "https://images.example.com/tee.jpg",
    colorBase: ["white"],
    season: ["summer"],
    style: ["minimalistic"],
  },
];

function buildLlmReport(overrides = {}): PersonalItemsReportLlmOutput {
  return {
    verdict: {
      status: "good",
      score: 0.76,
      summary: "The personal items are wearable with minor gaps.",
    },
    scores: {
      coverage: 0.86,
      outfitReadiness: 0.82,
      versatility: 0.8,
      seasonality: 0.78,
      styleClarity: 0.84,
      colorHarmony: 0.88,
      efficiency: 0.79,
    },
    personalItemsOverview: {
      itemCount: 2,
      personalItemsSize: "small",
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
      dominantStyles: ["minimalistic"],
      dominantSeasons: ["spring", "summer"],
      dominantFormalityLevels: ["casual"],
      summaryTags: ["Minimal", "Casual"],
    },
    coverage: {
      overallScore: 0.86,
      coreRoleCoverage: {
        tops: "adequate",
        bottoms: "adequate",
        shoes: "thin",
        layers: "missing",
        dresses: "not_applicable",
        accessories: "not_applicable",
      },
      missingCategories: [],
      weakCategories: ["shoes"],
      overrepresentedCategories: [],
      bottlenecks: [],
      notes: "The core separates are present.",
    },
    outfitReadiness: {
      overallScore: 0.82,
      supportedFormulaTypes: ["top_bottom_shoes"],
      estimatedOutfitRange: { min: 1, max: 2, confidence: "medium" },
      mainBlockers: ["Footwear is thin."],
      notes: "The set can support simple outfits.",
    },
    versatility: {
      overallScore: 0.8,
      mixAndMatchScore: 0.82,
      repeatabilityScore: 0.78,
      outfitVariety: "moderate",
      primaryUseModes: ["everyday"],
      limitingFactors: [],
      notes: "The pieces are easy to combine.",
    },
    styleProfile: {
      overallScore: 0.84,
      primaryStyles: ["minimalistic"],
      styleClusters: [
        {
          label: "Clean casual",
          style: "minimalistic",
          itemCount: 2,
          representativeItemIds: ["1", "2"],
          notes: "Simple casual basics.",
        },
      ],
      fragmentation: "low",
      notes: "The style direction is clear.",
    },
    seasonality: {
      overallScore: 0.78,
      seasonCoverage: {
        spring: "adequate",
        summer: "adequate",
        autumn: "thin",
        winter: "missing",
      },
      primarySeasons: ["spring", "summer"],
      weakSeasons: ["winter"],
      temperatureBandC: { min: 15, max: 28 },
      layeringSupport: "limited",
      weatherSuitability: ["dry", "warm"],
      weatherLimitations: [],
      notes: "Best for warm dry weather.",
    },
    colorAnalysis: {
      overallScore: 0.88,
      paletteType: "neutral",
      baseColors: ["white", "blue"],
      accentColors: [],
      contrastLevel: "medium",
      harmony: "cohesive",
      colorGaps: [],
      colorRisks: [],
      notes: "The colors are easy to style.",
    },
    efficiency: {
      overallScore: 0.79,
      redundancyLevel: "low",
      orphanItemRisk: "low",
      notableRedundancies: [],
      potentialOrphans: [],
      underusedStrengths: [],
      notes: "There is little redundancy.",
    },
    strengths: [
      {
        dimension: "style",
        message: "The casual basics are cohesive.",
        supportingItemIds: ["1", "2"],
      },
    ],
    issues: [],
    suggestions: [
      {
        type: "add",
        priority: "medium",
        targetItemIds: [],
        targetCategory: "shoes",
        replacementCategory: "shoes",
        replacementDescription: "simple white sneakers",
        expectedImpact: "increase_outfit_readiness",
        message: "Add simple sneakers to complete more outfits.",
      },
    ],
    confidence: {
      overall: 0.82,
      lowConfidenceAspects: ["exact_fit"],
      assumptions: ["The set is assessed from product images."],
    },
    ...overrides,
  } as PersonalItemsReportLlmOutput;
}

function createDeps({
  items = wardrobeItems,
  llmJson = buildLlmReport(),
} = {}) {
  const generateJsonWithLlm = vi.fn(async () => ({
    response: { usage: { total_tokens: 24 } },
    json: llmJson,
  }));
  return {
    buildPromptDebugImagesForCategoryImpl: vi.fn(async () => ({
      category: {
        category: "Personal Items",
        buffer: Buffer.from("personal-items"),
        cachedCount: 0,
        downloadedCount: 2,
        mimeType: "image/jpeg",
      },
    })),
    getGenerateJsonWithLlmImpl: vi.fn(() => generateJsonWithLlm),
    getPersonalItemsReportImpl: vi.fn(),
    getProfileImpl: vi.fn(async () => ({ llm: "openai:gpt-5.5" })),
    listWardrobeItemsImpl: vi.fn(async () => items),
    resolveLlmProviderImpl: vi.fn(() => ({
      provider: "openai",
      model: "gpt-5.5",
    })),
    runWithImageWorkSlotImpl: vi.fn(async (_label, work) => work()),
    saveLastPromptArtifactsImpl: vi.fn(),
    upsertPersonalItemsReportImpl: vi.fn(async (payload) => ({
      email: payload.email,
      generatedAt: "2026-06-19T10:00:00.000Z",
      personalItemUrls: payload.personalItemUrls,
      report: payload.report,
    })),
    generateJsonWithLlm,
  };
}

describe("generatePersonalItemsReport", () => {
  test("generates, scores, and persists a report with URL snapshot", async () => {
    const deps = createDeps();

    await expect(
      generatePersonalItemsReport("person@example.com", "office subset", deps),
    ).resolves.toMatchObject({
      generatedAt: "2026-06-19T10:00:00.000Z",
      personalItemUrls: ["https://example.com/jeans", "wardrobe://1"],
      report: {
        schemaVersion: 1,
        verdict: {
          llmScore: 0.76,
          llmStatus: "good",
          status: "good",
        },
      },
    });
    expect(deps.buildPromptDebugImagesForCategoryImpl).toHaveBeenCalledWith({
      category: "Personal Items",
      compactRows: true,
      items: [
        {
          id: "2",
          category: "bottom",
          imageUrl: "https://images.example.com/jeans.jpg",
        },
        {
          id: "1",
          category: "top",
          imageUrl: "https://images.example.com/tee.jpg",
        },
      ],
    });
    expect(deps.generateJsonWithLlm).toHaveBeenCalledWith(
      expect.stringContaining("office subset"),
      expect.objectContaining({
        format: expect.objectContaining({ name: "personal_items_report" }),
      }),
    );
    expect(deps.upsertPersonalItemsReportImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "person@example.com",
        personalItemUrls: ["https://example.com/jeans", "wardrobe://1"],
      }),
    );
  });

  test("rejects current items without URLs before persisting", async () => {
    const deps = createDeps({
      items: [{ ...wardrobeItems[0], url: "" }],
    });
    deps.getGenerateJsonWithLlmImpl = vi.fn(() => null as never);

    await expect(
      generatePersonalItemsReport("person@example.com", null, deps),
    ).rejects.toMatchObject({ code: "invalid_payload" });
    expect(deps.upsertPersonalItemsReportImpl).not.toHaveBeenCalled();
  });

  test("rejects current items without report ids before persisting", async () => {
    const deps = createDeps({
      items: [{ ...wardrobeItems[0], id: "" }],
    });

    await expect(
      generatePersonalItemsReport("person@example.com", null, deps),
    ).rejects.toMatchObject({
      code: "invalid_payload",
      message: "missing_item_id",
    });
    expect(deps.upsertPersonalItemsReportImpl).not.toHaveBeenCalled();
  });

  test("rejects empty wardrobes and unavailable report generators", async () => {
    await expect(
      generatePersonalItemsReport(
        "person@example.com",
        null,
        createDeps({ items: [] }),
      ),
    ).rejects.toMatchObject({ code: "not_found" });

    const deps = createDeps();
    deps.getGenerateJsonWithLlmImpl = vi.fn(() => null as never);

    await expect(
      generatePersonalItemsReport("person@example.com", null, deps),
    ).rejects.toMatchObject({
      code: "service_unavailable",
      message: "llm_unavailable",
    });
  });

  test("preserves domain errors and wraps unexpected generation failures", async () => {
    const domainDeps = createDeps();
    domainDeps.generateJsonWithLlm.mockRejectedValueOnce(
      buildPersonalItemsReportError("invalid_payload", "bad_llm_payload"),
    );

    await expect(
      generatePersonalItemsReport("person@example.com", null, domainDeps),
    ).rejects.toMatchObject({
      code: "invalid_payload",
      message: "bad_llm_payload",
    });

    const unexpectedDeps = createDeps();
    unexpectedDeps.generateJsonWithLlm.mockRejectedValueOnce(new Error("boom"));

    await expect(
      generatePersonalItemsReport("person@example.com", null, unexpectedDeps),
    ).rejects.toMatchObject({ code: "service_unavailable" });
  });
});

test("personal items report URL snapshots trim numbers and sort unique values", () => {
  expect(
    getPersonalItemUrls([
      { url: " wardrobe://2 " },
      { url: 42 },
      { url: "wardrobe://2" },
      { url: Number.NaN },
      { url: "" },
    ]),
  ).toEqual(["42", "wardrobe://2"]);
});

test("personal items report domain error helper classifies known codes", () => {
  expect(
    isPersonalItemsReportDomainError(
      buildPersonalItemsReportError("not_found"),
    ),
  ).toBe(true);
  expect(isPersonalItemsReportDomainError(new Error("boom"))).toBe(false);
});

test("personal items report validation rejects unknown referenced item ids", () => {
  const report = buildLlmReport({
    strengths: [
      {
        dimension: "style",
        message: "Unknown item.",
        supportingItemIds: ["missing"],
      },
    ],
  });

  expect(() =>
    parsePersonalItemsReportLlmOutput(report, {
      itemCount: 2,
      itemIds: ["1", "2"],
    }),
  ).toThrow(/unknown_strength_item_id/);
});

test("personal items report scoring preserves llm verdict values", () => {
  const scored = applyComputedPersonalItemsVerdictScore(
    buildLlmReport({
      verdict: {
        status: "good",
        score: 0.2,
        summary: "The report needs server-side scoring.",
      },
    }),
  );

  expect(scored.verdict).toMatchObject({
    llmScore: 0.2,
    llmStatus: "good",
    status: "good",
  });
});

test("personal items report scoring caps weak verdict and issue states", () => {
  const computeWith = (
    mutate: (report: PersonalItemsReportLlmOutput) => void,
  ) => {
    const report = buildLlmReport();
    mutate(report);
    return computeVerdictScore(report);
  };

  expect(computeWith((report) => (report.verdict.status = "incomplete"))).toBe(
    0.59,
  );
  expect(computeWith((report) => (report.verdict.status = "unbalanced"))).toBe(
    0.69,
  );
  expect(
    computeWith((report) => (report.verdict.status = "usable_with_gaps")),
  ).toBe(0.79);
  expect(
    computeWith((report) => {
      report.issues = [
        {
          code: "missing_shoes",
          severity: "critical",
          dimension: "coverage",
          message: "Missing shoes.",
          affectedItemIds: [],
          suggestion: "Add shoes.",
        },
      ];
    }),
  ).toBeLessThanOrEqual(0.69);
  expect(
    computeWith((report) => {
      report.issues = [
        {
          code: "thin_shoes",
          severity: "warning",
          dimension: "coverage",
          message: "Thin shoes.",
          affectedItemIds: [],
          suggestion: "Add another pair.",
        },
      ];
    }),
  ).toBeLessThanOrEqual(0.89);
});

test("personal items report scoring caps weak wardrobe structure", () => {
  const computeWith = (
    mutate: (report: PersonalItemsReportLlmOutput) => void,
  ) => {
    const report = buildLlmReport();
    mutate(report);
    return computeVerdictScore(report);
  };

  expect(
    computeWith((report) => {
      report.coverage.coreRoleCoverage.tops = "missing";
    }),
  ).toBe(0.59);
  expect(
    computeWith((report) => {
      report.coverage.coreRoleCoverage.bottoms = "thin";
    }),
  ).toBeLessThanOrEqual(0.79);
  expect(
    computeWith((report) => {
      report.personalItemsOverview.categoryCounts.dress = 1;
      report.coverage.coreRoleCoverage.tops = "missing";
      report.coverage.coreRoleCoverage.dresses = "thin";
    }),
  ).toBeLessThanOrEqual(0.79);
  expect(
    computeWith((report) => {
      report.outfitReadiness.overallScore = 0.35;
    }),
  ).toBe(0.59);
  expect(
    computeWith((report) => {
      report.outfitReadiness.supportedFormulaTypes = [];
    }),
  ).toBe(0.59);
  expect(
    computeWith((report) => {
      report.outfitReadiness.estimatedOutfitRange.max = 0;
    }),
  ).toBe(0.59);
  expect(
    computeWith((report) => {
      report.outfitReadiness.overallScore = 0.5;
      report.scores.outfitReadiness = 0.5;
    }),
  ).toBeLessThanOrEqual(0.69);
  expect(
    computeWith((report) => {
      report.outfitReadiness.overallScore = 0.6;
      report.scores.outfitReadiness = 0.6;
    }),
  ).toBeLessThanOrEqual(0.79);
});

test("personal items report scoring caps category balance confidence and low dimensions", () => {
  const computeWith = (
    mutate: (report: PersonalItemsReportLlmOutput) => void,
  ) => {
    const report = buildLlmReport();
    mutate(report);
    return computeVerdictScore(report);
  };

  expect(
    computeWith((report) => {
      report.personalItemsOverview.detectedCategoryBalance = "fragmented";
    }),
  ).toBeLessThanOrEqual(0.74);
  expect(
    computeWith((report) => {
      report.personalItemsOverview.detectedCategoryBalance = "shoe_limited";
    }),
  ).toBeLessThanOrEqual(0.84);
  expect(
    computeWith((report) => {
      report.personalItemsOverview.detectedCategoryBalance = "top_heavy";
    }),
  ).toBeLessThanOrEqual(0.89);
  expect(
    computeWith((report) => {
      report.scores.coverage = 0.35;
    }),
  ).toBe(0.59);
  expect(
    computeWith((report) => {
      report.scores.outfitReadiness = 0.5;
    }),
  ).toBeLessThanOrEqual(0.69);
  expect(
    computeWith((report) => {
      report.scores.versatility = 0.4;
    }),
  ).toBeLessThanOrEqual(0.74);
  expect(
    computeWith((report) => {
      report.scores.seasonality = 0.35;
    }),
  ).toBeLessThanOrEqual(0.79);
  expect(
    computeWith((report) => {
      report.confidence.overall = 0.3;
    }),
  ).toBe(0.59);
  expect(
    computeWith((report) => {
      report.confidence.overall = 0.4;
    }),
  ).toBeLessThanOrEqual(0.69);
});
