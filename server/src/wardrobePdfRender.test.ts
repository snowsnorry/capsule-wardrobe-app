import { test, expect } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { buildLocalImageCachePath } from "./ai/promptImages.js";
import { buildWardrobePdf } from "./wardrobePdfRender.js";
import {
  formatReportValue,
  getReportChipValues,
  getReportScoreRows,
  getReportTemperatureLabel,
  getReportVerdictLabel,
  outfitNeedsUnicodeFallback,
  toPercent,
} from "./wardrobePdfOutfit.js";
import { getScoreTone } from "./wardrobePdfOutfitReport.js";
import {
  capsuleReportNeedsUnicodeFallback,
  getCapsuleGeneratedOutfitsOverview,
  getCapsuleOverviewLines,
  getCapsuleReportChipValues,
  getCapsuleReportScoreRows,
  getCapsuleReportTemperatureLabel,
  getCapsuleReportVerdictLabel,
  getCapsuleWeakOutfitOverviewRows,
} from "./wardrobePdfCapsuleReport.js";
import {
  getPersonalItemsReportChipValues,
  getPersonalItemsReportOverviewLines,
  getPersonalItemsReportScoreRows,
  getPersonalItemsReportTemperatureLabel,
  getPersonalItemsReportVerdictLabel,
  personalItemsReportNeedsUnicodeFallback,
} from "./wardrobePdfPersonalItemsReport.js";
import {
  getCoverageBottleneckRows,
  getPersonalItemsReportOverviewRowGroups,
} from "./wardrobePdfPersonalItemsReportBasicSections.js";
import { getSuggestionRows } from "./wardrobePdfPersonalItemsReportFindingSections.js";
import { severityToReportTone } from "./wardrobePdfPersonalItemsReportPrimitives.js";

async function withCachedImage(testContext, imageUrl, buffer) {
  const cachePath = buildLocalImageCachePath(imageUrl);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buffer);
  testContext.onTestFinished(async () => {
    await rm(cachePath, { force: true });
  });
}

async function getPdfPageCount(buffer) {
  return (await PDFDocument.load(buffer)).getPageCount();
}

function buildReport(overrides = {}) {
  return {
    verdict: {
      status: "valid",
      score: 0.9,
      summary: "This outfit is ready to wear.",
    },
    seasonality: {
      primarySeasons: ["spring"],
      temperatureBandC: { min: 10, max: 18 },
      seasonScore: 0.8,
    },
    styleProfile: {
      formalityLevel: "casual",
      primaryStyle: "minimalistic",
      styleScore: 0.85,
    },
    compatibility: {
      overallScore: 0.9,
      styleCoherence: 0.86,
      formalityCoherence: 0.88,
      seasonalCoherence: 0.8,
      colorCoherence: 0.92,
      mainStrengths: ["Balanced proportions."],
      mainRisks: ["Needs a warmer layer below 10C."],
    },
    colorAnalysis: {
      paletteType: "neutral",
      colorScore: 0.92,
    },
    issues: [
      {
        message: "Low warmth for evening wear.",
        suggestion: "Add a midlayer.",
        affectedItemIds: ["item-1"],
      },
    ],
    suggestions: [
      {
        priority: "high",
        message: "Keep the shoes and bag together.",
        targetItemIds: ["item-2"],
      },
    ],
    confidence: {
      overall: 0.8,
      assumptions: ["Based on available item metadata."],
    },
    ...overrides,
  };
}

function buildCapsuleReport(overrides = {}) {
  return {
    verdict: {
      llmStatus: "excellent",
      status: "excellent",
      score: 0.9,
      summary: "This capsule is balanced and ready to use.",
    },
    capsuleSummary: {
      itemCount: 12,
      categoryCounts: { dress: 0 },
      detectedCategoryBalance: "balanced",
      capsuleType: "travel",
      summaryTags: ["minimal"],
    },
    targetAlignment: {
      overallScore: 0.86,
      formalityFit: { detectedRange: ["casual"] },
      styleFit: { primaryDetectedStyle: "minimalistic" },
    },
    coverage: {
      overallScore: 0.8,
      coreRoleCoverage: {
        tops: "covered",
        bottoms: "covered",
        shoes: "covered",
        layers: "thin",
        accessories: "weak",
      },
      weakCategories: ["layers"],
      notes: "Good foundation with light layering gaps.",
    },
    versatility: {
      overallScore: 0.78,
      notes: "Works across repeated travel days.",
    },
    cohesion: {
      overallScore: 0.84,
      mainStrengths: ["Clear color direction."],
      mainRisks: ["Limited warm layer options."],
    },
    seasonality: {
      overallScore: 0.75,
      primarySeasons: ["spring"],
      temperatureBandC: { min: 12, max: 22 },
      notes: "Best for mild weather.",
    },
    colorAnalysis: {
      paletteType: "neutral",
      colorScore: 0.88,
      notes: "Base palette is coherent.",
    },
    generatedOutfitAssessment: {
      providedOutfitCount: 2,
      completeOutfitCount: 1,
      weakOutfitCount: 1,
      weakOutfits: [
        {
          outfitId: "outfit-set-2",
          issue: "Needs stronger layering.",
          suggestion: "Add a compact jacket.",
        },
      ],
    },
    issues: [
      {
        code: "layering_gap",
        severity: "warning",
        message: "Layering is thin.",
        suggestion: "Add a warmer layer.",
      },
    ],
    suggestions: [
      {
        type: "add",
        priority: "high",
        message: "Add one compact outerwear option.",
      },
    ],
    confidence: {
      overall: 0.82,
      assumptions: ["Based on item metadata."],
    },
    ...overrides,
  };
}

function buildPersonalItemsReport(overrides = {}) {
  return {
    verdict: {
      llmStatus: "good",
      status: "good",
      score: 0.82,
      summary: "A useful set with a clear casual direction.",
    },
    scores: {
      coverage: 0.7,
      outfitReadiness: 0.62,
      versatility: 0.75,
      seasonality: 0.8,
      styleClarity: 0.76,
      colorHarmony: 0.88,
      efficiency: 0.68,
    },
    personalItemsOverview: {
      itemCount: 8,
      personalItemsSize: "small",
      detectedCategoryBalance: "tops heavy",
      dominantStyles: ["minimalistic"],
      dominantSeasons: ["spring"],
      dominantFormalityLevels: ["casual"],
      summaryTags: ["compact"],
    },
    coverage: {
      overallScore: 0.7,
      coreRoleCoverage: {
        tops: "covered",
        bottoms: "thin",
        shoes: "missing",
        layers: "covered",
        dresses: "not_needed",
        accessories: "weak",
      },
      missingCategories: ["shoes"],
      weakCategories: ["accessories"],
      overrepresentedCategories: ["tops"],
      bottlenecks: [
        {
          category: "shoes",
          severity: "warning",
          message: "Shoes are the main bottleneck.",
        },
      ],
      notes: "Coverage is usable but incomplete.",
    },
    outfitReadiness: {
      overallScore: 0.62,
      supportedFormulaTypes: ["top_bottom_shoes"],
      estimatedOutfitRange: { min: 3, max: 6, confidence: "medium" },
      mainBlockers: ["No versatile shoes."],
      notes: "Ready for simple casual outfits.",
    },
    versatility: {
      overallScore: 0.75,
      mixAndMatchScore: 0.8,
      repeatabilityScore: 0.65,
      outfitVariety: "moderate",
      primaryUseModes: ["everyday"],
      limitingFactors: ["Small footwear range."],
      notes: "Good repeatability for a compact set.",
    },
    styleProfile: {
      overallScore: 0.76,
      primaryStyles: ["minimalistic"],
      fragmentation: "low",
      styleClusters: [
        {
          label: "Minimal casual",
          style: "minimalistic",
          itemCount: 3,
          representativeItemIds: ["1"],
          notes: "Clean daily base.",
        },
      ],
      notes: "Style direction is clear.",
    },
    seasonality: {
      overallScore: 0.8,
      seasonCoverage: {
        spring: "covered",
        summer: "covered",
        autumn: "partial",
        winter: "weak",
      },
      primarySeasons: ["spring"],
      weakSeasons: ["winter"],
      temperatureBandC: { min: 8, max: 22 },
      layeringSupport: "light",
      weatherSuitability: ["mild_weather"],
      weatherLimitations: ["Cold rain."],
      notes: "Best for mild weather.",
    },
    colorAnalysis: {
      overallScore: 0.88,
      paletteType: "neutral",
      baseColors: ["black", "white"],
      accentColors: ["blue"],
      contrastLevel: "medium",
      harmony: "cohesive",
      colorGaps: ["warm accent"],
      colorRisks: ["Too much black."],
      notes: "Base palette is coherent.",
    },
    efficiency: {
      overallScore: 0.68,
      redundancyLevel: "medium",
      orphanItemRisk: "low",
      notableRedundancies: [
        {
          category: "tops",
          itemIds: ["1"],
          message: "Several tops fill the same casual role.",
        },
      ],
      potentialOrphans: [
        {
          itemIds: ["1"],
          reason: "Needs a matching shoe option.",
        },
      ],
      underusedStrengths: ["Neutral palette."],
      notes: "Efficiency is acceptable for a compact wardrobe.",
    },
    strengths: [
      {
        dimension: "style",
        message: "Clear style base.",
        supportingItemIds: ["1"],
      },
    ],
    issues: [
      {
        code: "missing-shoes",
        severity: "warning",
        dimension: "coverage",
        message: "Missing shoes block outfits.",
        affectedItemIds: ["1"],
        suggestion: "Add a simple shoe option.",
      },
    ],
    suggestions: [
      {
        type: "add",
        priority: "high",
        message: "Add simple sneakers.",
        expectedImpact: "More complete outfits.",
        targetCategory: "shoes",
        replacementCategory: "sneakers",
        replacementDescription: "Low-profile neutral sneakers.",
        targetItemIds: ["1"],
      },
    ],
    confidence: {
      overall: 0.72,
      lowConfidenceAspects: ["weather metadata"],
      assumptions: ["Metadata is current."],
    },
    ...overrides,
  };
}

test("buildWardrobePdf consumes prepared image assets as pages are rendered", async (_t) => {
  const imageBuffer = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: "#aa6644",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  const imageAssetsById = {
    "top-1": {
      buffer: imageBuffer,
      mimeType: "image/jpeg",
      kind: "jpg",
      preparedForPdf: true,
      imageUrl: "https://example.com/top-1.jpg",
    },
  };

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl: "https://example.com/top-1.jpg",
        brand: "Brand",
        description: "Description",
      },
    ],
    {
      locale: "ru",
      imageAssetsById,
    },
  );

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(Object.keys(imageAssetsById).length).toBe(0);
});

test("buildWardrobePdf uses local cached image before remote fetch", async (t) => {
  const imageUrl =
    "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  const cachedJpeg = await sharp({
    create: {
      width: 1000,
      height: 700,
      channels: 3,
      background: "#0f766e",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, cachedJpeg);
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl,
        brand: "Brand",
        description: "Description",
      },
    ],
    {
      locale: "en",
    },
  );

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(pdfBuffer.length > 0).toBeTruthy();
});

test("buildWardrobePdf renders fallback title and image placeholder without remote image", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };
  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "",
        name: "",
        category: "",
        imageUrl: "",
        brand: "",
        description: "",
        url: "not-a-url",
      },
    ],
    {
      locale: "en",
      totalStartedAt: Date.now(),
    },
  );

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(pdfBuffer.length > 0).toBeTruthy();
});

test("buildWardrobePdf prepends outfit image cover and appends stale report pages", async (t) => {
  const imageUrl = "https://images.example.com/outfit-cover.jpg";
  const imageBuffer = await sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: "#d8c0a0",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, imageBuffer);

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "1",
        name: "White Tee",
        category: "top",
        imageUrl: "",
      },
    ],
    {
      locale: "en",
      outfit: {
        title: "Weekend",
        imageUrl,
        imageStale: true,
        report: buildReport(),
        reportStale: true,
      },
    },
  );

  expect(await getPdfPageCount(pdfBuffer)).toBe(3);
});

test("buildWardrobePdf appends capsule report pages after capsule products", async () => {
  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl: "",
      },
    ],
    {
      locale: "en",
      capsule: {
        title: "Travel capsule",
        report: buildCapsuleReport(),
        reportStale: true,
      },
    },
  );

  expect(await getPdfPageCount(pdfBuffer)).toBe(3);
});

test("buildWardrobePdf appends personal items report pages after wardrobe items", async () => {
  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl: "",
      },
    ],
    {
      locale: "en",
      personalItems: {
        report: buildPersonalItemsReport(),
        reportStale: true,
      },
    },
  );

  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(1);
});

test("buildWardrobePdf supports image-only report-only and plain product PDFs", async (t) => {
  const imageUrl = "https://images.example.com/outfit-only.jpg";
  const imageBuffer = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 3,
      background: "#1c7c7c",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, imageBuffer);

  const imageOnly = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Image only", imageUrl },
  });
  const reportOnly = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Report only", report: buildReport() },
  });
  const capsuleReportOnly = await buildWardrobePdf([], {
    locale: "en",
    capsule: {
      title: "Capsule report only",
      report: buildCapsuleReport(),
    },
  });
  const personalItemsReportOnly = await buildWardrobePdf([], {
    locale: "en",
    personalItems: { report: buildPersonalItemsReport() },
  });
  const productOnly = await buildWardrobePdf(
    [{ id: "top-1", name: "Top", imageUrl: "" }],
    {
      locale: "en",
    },
  );

  expect(await getPdfPageCount(imageOnly)).toBe(1);
  expect(await getPdfPageCount(reportOnly)).toBe(1);
  expect(await getPdfPageCount(capsuleReportOnly)).toBeGreaterThan(0);
  expect(await getPdfPageCount(personalItemsReportOnly)).toBeGreaterThan(0);
  expect(await getPdfPageCount(productOnly)).toBe(1);
});

test("buildWardrobePdf paginates long outfit reports at the end", async () => {
  const longReport = buildReport({
    compatibility: {
      overallScore: 0.9,
      styleCoherence: 0.86,
      formalityCoherence: 0.88,
      seasonalCoherence: 0.8,
      colorCoherence: 0.92,
      mainStrengths: Array.from(
        { length: 90 },
        (_, index) =>
          `Strength ${index + 1}: this line intentionally has enough detail to wrap in the PDF report.`,
      ),
      mainRisks: [],
    },
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Long report", report: longReport },
  });

  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(1);
});

test("buildWardrobePdf wraps long report chips and issue suggestions", async () => {
  const wrappedReport = buildReport({
    seasonality: {
      primarySeasons: [
        "very_long_transitional_weather_label_that_forces_chip_wrapping",
        "another_long_weather_context_for_the_next_chip_row",
      ],
      temperatureBandC: { min: 5, max: 21 },
      seasonScore: 0.8,
    },
    styleProfile: {
      formalityLevel: "very_detailed_smart_casual_context",
      primaryStyle: "minimalist_layered_city_utility_with_extra_detail",
      styleScore: 0.85,
    },
    colorAnalysis: {
      paletteType: "muted_neutral_with_extended_accent_context",
      colorScore: 0.92,
    },
    issues: [
      { message: "", suggestion: "" },
      {
        message: "Layering may need adjustment.",
        suggestion:
          "Use a compact thermal layer under the jacket when the morning starts cold and remove it indoors after commuting.",
      },
    ],
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Wrapped report", report: wrappedReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(0);
});

test("buildWardrobePdf paginates long capsule reports at the end", async () => {
  const longReport = buildCapsuleReport({
    cohesion: {
      overallScore: 0.84,
      mainStrengths: Array.from(
        { length: 90 },
        (_, index) =>
          `Strength ${index + 1}: this capsule line intentionally has enough detail to wrap in the PDF report.`,
      ),
      mainRisks: [],
    },
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    capsule: { title: "Long capsule report", report: longReport },
  });

  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(1);
});

test("buildWardrobePdf paginates long personal items reports at the end", async () => {
  const longReport = buildPersonalItemsReport({
    strengths: Array.from({ length: 90 }, (_, index) => ({
      dimension: "style",
      message: `Strength ${index + 1}: this personal items line intentionally has enough detail to wrap in the PDF report.`,
      supportingItemIds: [],
    })),
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    personalItems: { report: longReport },
  });

  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(1);
});

test("buildWardrobePdf handles sparse personal items reports without optional sections", async () => {
  const sparseReport = {
    verdict: {},
    personalItemsOverview: {},
    scores: {},
    coverage: {},
    outfitReadiness: {},
    versatility: {},
    styleProfile: {},
    seasonality: {},
    colorAnalysis: {},
    efficiency: {},
    strengths: [],
    issues: [{ message: "", suggestion: "" }],
    suggestions: [{ message: "" }],
    confidence: {
      assumptions: ["Assumption without confidence score."],
    },
  };

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    personalItems: { report: sparseReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBe(1);
});

test("buildWardrobePdf renders partial personal items basic report sections", async () => {
  const partialReport = {
    verdict: {
      summary: "Partial basic sections.",
      score: 0.61,
    },
    coverage: {
      bottlenecks: [
        { category: "", message: "" },
        { message: "One bottleneck without a category." },
      ],
    },
    outfitReadiness: {
      estimatedOutfitRange: { min: 2 },
    },
    versatility: {
      primaryUseModes: ["travel"],
    },
  };

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    personalItems: { report: partialReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(0);
});

test("buildWardrobePdf renders partial personal items profile report sections", async () => {
  const partialReport = {
    verdict: {
      summary: "Partial profile sections.",
      score: 0.64,
    },
    styleProfile: {
      styleClusters: [
        {
          representativeItemIds: ["missing-item"],
        },
      ],
    },
    seasonality: {
      temperatureBandC: { max: 24 },
    },
    colorAnalysis: {
      colorRisks: ["One color risk."],
    },
    efficiency: {
      notableRedundancies: [{ itemIds: ["missing-item"] }],
      potentialOrphans: [{ reason: "Only reason." }],
    },
  };

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    personalItems: { report: partialReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(0);
});

test("buildWardrobePdf wraps long capsule report chips", async () => {
  const wrappedReport = buildCapsuleReport({
    seasonality: {
      overallScore: 0.75,
      primarySeasons: [
        "very_long_transitional_weather_label_that_forces_capsule_chip_wrapping",
        "another_long_weather_context_for_the_next_capsule_chip_row",
      ],
      temperatureBandC: { min: 5, max: 21 },
      notes: "Best for shifting weather.",
    },
    targetAlignment: {
      overallScore: 0.86,
      formalityFit: {
        detectedRange: ["very_detailed_smart_casual_capsule_context"],
      },
      styleFit: {
        primaryDetectedStyle:
          "minimalist_layered_city_utility_with_extra_capsule_detail",
      },
    },
    colorAnalysis: {
      paletteType: "muted_neutral_with_extended_accent_context",
      colorScore: 0.88,
      notes: "Base palette is coherent.",
    },
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    capsule: { title: "Wrapped capsule report", report: wrappedReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(0);
});

test("buildWardrobePdf handles sparse capsule reports without optional sections", async () => {
  const sparseReport = {
    verdict: {},
    capsuleSummary: {},
    coverage: {},
    cohesion: {
      mainStrengths: [],
      mainRisks: ["Risk without a matching issue."],
    },
    issues: [
      { message: "", suggestion: "" },
      { message: "Issue without suggestion.", suggestion: "" },
    ],
    suggestions: [{ message: "" }],
    confidence: {
      assumptions: ["Assumption without confidence score."],
    },
  };

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    capsule: { title: "Sparse capsule report", report: sparseReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBe(1);
});

test("outfit pdf report helpers mirror desktop report labels and percentages", () => {
  const report = buildReport();

  expect(toPercent("bad")).toBe(null);
  expect(toPercent(-1)).toBe(0);
  expect(toPercent(2)).toBe(100);
  expect(formatReportValue("acceptable_with_notes")).toBe(
    "Acceptable With Notes",
  );
  expect(getReportTemperatureLabel(report, "en")).toBe("10–18°C");
  expect(
    getReportTemperatureLabel(
      { seasonality: { temperatureBandC: { min: 12 } } },
      "en",
    ),
  ).toBe("from 12°C");
  expect(
    getReportTemperatureLabel(
      { seasonality: { temperatureBandC: { max: 20 } } },
      "en",
    ),
  ).toBe("up to 20°C");
  expect(getReportTemperatureLabel({ seasonality: {} }, "en")).toBe(null);
  expect(getReportChipValues(report, "en")).toEqual([
    "10–18°C",
    "spring",
    "casual",
    "minimalistic",
    "neutral",
  ]);
  expect(getReportScoreRows(report, "en")).toEqual([
    expect.objectContaining({ key: "style", percent: 86 }),
    expect.objectContaining({ key: "color", percent: 92 }),
    expect.objectContaining({ key: "season", percent: 80 }),
    expect.objectContaining({ key: "formality", percent: 88 }),
    expect.objectContaining({ key: "overall", percent: 90 }),
  ]);
  expect(
    getReportScoreRows(
      {
        styleProfile: { styleScore: 0.7 },
        colorAnalysis: { colorScore: 0.6 },
        seasonality: { seasonScore: 0.5 },
      },
      "en",
    ),
  ).toEqual([
    expect.objectContaining({ key: "style", percent: 70 }),
    expect.objectContaining({ key: "color", percent: 60 }),
    expect.objectContaining({ key: "season", percent: 50 }),
  ]);
  expect(getReportVerdictLabel({}, "en")).toBe("Good match");
  expect(
    getReportVerdictLabel({ verdict: { status: "incomplete" } }, "en"),
  ).toBe("Incomplete");
  expect(
    getReportVerdictLabel(
      { verdict: { llmStatus: "valid", score: 0.5, status: "valid" } },
      "en",
    ),
  ).toBe("Incomplete");
  expect(
    getReportVerdictLabel(
      { verdict: { llmStatus: "incoherent", score: 0.5, status: "valid" } },
      "en",
    ),
  ).toBe("Needs work");
  expect(getScoreTone(null)).toBe("neutral");
  expect(getScoreTone(75)).toBe("success");
  expect(getScoreTone(60)).toBe("warning");
  expect(getScoreTone(59)).toBe("error");
  expect(outfitNeedsUnicodeFallback({ title: "Weekend" }, "en")).toBe(false);
  expect(outfitNeedsUnicodeFallback({ title: "Выходной" }, "en")).toBe(true);
  expect(outfitNeedsUnicodeFallback({ title: "Weekend" }, "ru")).toBe(true);
});

test("capsule pdf report helpers mirror desktop report labels and percentages", () => {
  const report = buildCapsuleReport();

  expect(getCapsuleReportTemperatureLabel(report, "en")).toBe("12–22°C");
  expect(
    getCapsuleReportTemperatureLabel(
      { seasonality: { temperatureBandC: { min: 12 } } },
      "en",
    ),
  ).toBe("from 12°C");
  expect(
    getCapsuleReportTemperatureLabel(
      { seasonality: { temperatureBandC: { max: 20 } } },
      "en",
    ),
  ).toBe("up to 20°C");
  expect(getCapsuleReportChipValues(report)).toEqual([
    "spring",
    "casual",
    "minimalistic",
    "neutral",
  ]);
  expect(getCapsuleReportScoreRows(report, "en")).toEqual([
    expect.objectContaining({ key: "target", percent: 86 }),
    expect.objectContaining({ key: "coverage", percent: 80 }),
    expect.objectContaining({ key: "versatility", percent: 78 }),
    expect.objectContaining({ key: "cohesion", percent: 84 }),
    expect.objectContaining({ key: "season", percent: 75 }),
    expect.objectContaining({ key: "color", percent: 88 }),
  ]);
  expect(getCapsuleOverviewLines(report, "en")).toEqual([
    "12 items · travel · balanced",
    "Strong coverage for Tops, Bottoms, Shoes, Layers; Layers are the main limiting role.",
    "2 generated outfits provided, 1 complete, 1 weak.",
  ]);
  expect(getCapsuleWeakOutfitOverviewRows(report, "en")).toEqual([
    {
      key: "outfit-set-2-0",
      outfitLabel: "Outfit 2",
      issue: "Needs stronger layering.",
      suggestion: "Add a compact jacket.",
    },
  ]);
  expect(getCapsuleReportVerdictLabel(report, "en")).toBe("Excellent capsule");
  expect(
    getCapsuleReportVerdictLabel(
      { verdict: { llmStatus: "incoherent", score: 0.5 } },
      "en",
    ),
  ).toBe("Off target");
  expect(
    capsuleReportNeedsUnicodeFallback({ title: "Travel capsule" }, "en"),
  ).toBe(false);
  expect(capsuleReportNeedsUnicodeFallback({ title: "Капсула" }, "en")).toBe(
    true,
  );
  expect(
    capsuleReportNeedsUnicodeFallback({ title: "Travel capsule" }, "ru"),
  ).toBe(true);
});

test("capsule pdf report helpers handle sparse reports", () => {
  expect(getCapsuleReportTemperatureLabel({}, "en")).toBe(null);
  expect(getCapsuleReportChipValues({})).toEqual([]);
  expect(getCapsuleReportScoreRows({}, "en")).toEqual([]);
  expect(getCapsuleGeneratedOutfitsOverview({}, "en")).toBe("");
  expect(
    getCapsuleGeneratedOutfitsOverview(
      {
        generatedOutfitAssessment: {
          providedOutfitCount: 0,
          completeOutfitCount: 0,
          weakOutfitCount: 0,
        },
      },
      "en",
    ),
  ).toBe("");
  expect(
    getCapsuleWeakOutfitOverviewRows(
      {
        generatedOutfitAssessment: {
          weakOutfits: [
            { outfitId: "custom-outfit", issue: "", suggestion: "" },
            { outfitId: "custom-outfit", issue: "Issue only", suggestion: "" },
          ],
        },
      },
      "en",
    ),
  ).toEqual([
    {
      key: "custom-outfit-1",
      outfitLabel: "Outfit 2",
      issue: "Issue only",
      suggestion: "",
    },
  ]);
  expect(
    getCapsuleOverviewLines(
      {
        capsuleSummary: { capsuleType: "daily" },
        coverage: { weakCategories: ["shoes"] },
      },
      "en",
    ),
  ).toEqual(["daily", "Shoes are the main limiting role."]);
  expect(getCapsuleReportVerdictLabel({}, "en")).toBe("Good capsule");
});

test("personal items pdf report helpers mirror desktop report labels and percentages", () => {
  const report = buildPersonalItemsReport();

  expect(getPersonalItemsReportTemperatureLabel(report, "en")).toBe("8–22°C");
  expect(
    getPersonalItemsReportTemperatureLabel(
      { seasonality: { temperatureBandC: { min: 12 } } },
      "en",
    ),
  ).toBe("from 12°C");
  expect(
    getPersonalItemsReportTemperatureLabel(
      { seasonality: { temperatureBandC: { max: 20 } } },
      "en",
    ),
  ).toBe("up to 20°C");
  expect(getPersonalItemsReportChipValues(report)).toEqual([
    "spring",
    "minimalistic",
    "neutral",
  ]);
  expect(getPersonalItemsReportScoreRows(report, "en")).toEqual([
    expect.objectContaining({ key: "coverage", percent: 70 }),
    expect.objectContaining({ key: "outfit-readiness", percent: 62 }),
    expect.objectContaining({ key: "versatility", percent: 75 }),
    expect.objectContaining({ key: "seasonality", percent: 80 }),
    expect.objectContaining({ key: "style-clarity", percent: 76 }),
    expect.objectContaining({ key: "color-harmony", percent: 88 }),
    expect.objectContaining({ key: "efficiency", percent: 68 }),
  ]);
  expect(getPersonalItemsReportOverviewLines(report, "en")).toEqual([
    "8 items · small · tops heavy",
    "Dominant styles: Minimalistic · Dominant seasons: Spring",
    "Dominant formality levels: Casual · Summary tags: Compact",
  ]);
  expect(getPersonalItemsReportVerdictLabel(report, "en")).toBe(
    "Good Personal items set",
  );
  expect(
    getPersonalItemsReportVerdictLabel(
      { verdict: { llmStatus: "unclear", score: 0.3 } },
      "en",
    ),
  ).toBe("Unclear");
  expect(personalItemsReportNeedsUnicodeFallback({}, "en")).toBe(false);
  expect(
    personalItemsReportNeedsUnicodeFallback(
      { report: { verdict: { summary: "Личные вещи" } } },
      "en",
    ),
  ).toBe(true);
  expect(personalItemsReportNeedsUnicodeFallback({}, "ru")).toBe(true);
});

test("personal items pdf section helpers mirror UI row and severity models", () => {
  const report = buildPersonalItemsReport({
    coverage: {
      bottlenecks: [
        {
          category: "shoes",
          severity: "warning",
          message: "Shoes are the main bottleneck.",
        },
        {
          category: "layers",
          severity: "info",
          message: "Layering options are optional context.",
        },
      ],
    },
  });

  expect(getPersonalItemsReportOverviewRowGroups(report, "en")).toEqual({
    detailRows: [
      expect.objectContaining({
        key: "tags",
        label: "Summary tags",
        value: ["compact"],
      }),
    ],
    rows: [
      expect.objectContaining({
        key: "balance",
        label: "Detected category balance",
        value: "tops heavy",
      }),
      expect.objectContaining({
        key: "styles",
        label: "Dominant styles",
        value: ["minimalistic"],
      }),
      expect.objectContaining({
        key: "seasons",
        label: "Dominant seasons",
        value: ["spring"],
      }),
      expect.objectContaining({
        key: "formality",
        label: "Dominant formality levels",
        value: ["casual"],
      }),
    ],
  });
  expect(getCoverageBottleneckRows(report.coverage)).toEqual([
    {
      message: "Shoes are the main bottleneck.",
      prefix: "Shoes:",
      tone: "warning",
    },
    {
      message: "Layering options are optional context.",
      prefix: "Layers:",
      tone: "neutral",
    },
  ]);
  expect(getSuggestionRows(report.suggestions[0], "en")).toEqual([
    expect.objectContaining({
      key: "impact",
      label: "Expected impact",
      value: "More complete outfits.",
    }),
    expect.objectContaining({
      key: "target",
      label: "Target category",
      value: "shoes",
    }),
    expect.objectContaining({
      key: "replacement-category",
      label: "Replacement category",
      value: "sneakers",
    }),
    expect.objectContaining({
      key: "replacement-description",
      label: "Replacement description",
      value: "Low-profile neutral sneakers.",
    }),
  ]);
  expect(severityToReportTone("Critical")).toBe("error");
  expect(severityToReportTone("warning")).toBe("warning");
  expect(severityToReportTone("info")).toBe("neutral");
  expect(severityToReportTone("")).toBe("neutral");
});

test("personal items pdf report helpers handle sparse reports", () => {
  expect(getPersonalItemsReportTemperatureLabel({}, "en")).toBe(null);
  expect(getPersonalItemsReportChipValues({})).toEqual([]);
  expect(getPersonalItemsReportScoreRows({}, "en")).toEqual([]);
  expect(getPersonalItemsReportOverviewLines({}, "en")).toEqual([]);
  expect(getPersonalItemsReportVerdictLabel({}, "en")).toBe(
    "Good Personal items set",
  );
});
