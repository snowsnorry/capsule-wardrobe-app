import { describe, expect, test } from "vitest";
import {
  applyComputedCapsuleVerdictScore,
  computeVerdictScore,
} from "./capsuleReportScoring.js";
import type { CapsuleReportLlmOutput } from "./capsuleReportTypes.js";

function buildReport(score: number): CapsuleReportLlmOutput {
  return {
    verdict: {
      status: "good",
      score,
      summary: "The capsule works well.",
    },
    capsuleSummary: {
      itemCount: 1,
      categoryCounts: {
        top: 1,
        bottom: 0,
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
      summaryTags: ["Minimal"],
    },
    targetAlignment: {
      overallScore: score,
      audienceFit: { score, verdict: "strong", notes: "Aligned." },
      occasionFit: {
        score,
        matchedOccasions: ["office"],
        weakOccasions: [],
        notes: "Office is supported.",
      },
      formalityFit: {
        score,
        detectedRange: ["smart_casual"],
        targetMatched: true,
        notes: "Matches.",
      },
      styleFit: {
        score,
        primaryDetectedStyle: "minimalistic",
        secondaryDetectedStyles: [],
        targetMatched: true,
        notes: "Clean.",
      },
      accentColorFit: {
        score: 1,
        targetAccentColor: null,
        presentAs: "unclear",
        notes: "No target accent.",
      },
      patternFit: {
        score: 1,
        targetPattern: null,
        verdict: "not_applicable",
        notes: "No pattern target.",
      },
      additionalInfoFit: {
        score: 1,
        interpretedRequirements: [],
        unmetRequirements: [],
        notes: "No extra requirements.",
      },
    },
    coverage: {
      overallScore: score,
      coreRoleCoverage: {
        tops: "adequate",
        bottoms: "thin",
        shoes: "thin",
        layers: "thin",
        accessories: "missing",
      },
      missingCategories: [],
      weakCategories: [],
      overrepresentedCategories: [],
      bottlenecks: [],
      notes: "Coverage is limited but clear.",
    },
    versatility: {
      overallScore: score,
      mixAndMatchScore: score,
      repeatabilityScore: score,
      outfitVariety: "moderate",
      primaryOutfitModes: ["office"],
      limitingFactors: [],
      notes: "Usable.",
    },
    cohesion: {
      overallScore: score,
      styleCoherence: score,
      formalityCoherence: score,
      silhouetteCoherence: score,
      materialCoherence: score,
      colorCoherence: score,
      mainStrengths: ["Simple palette."],
      mainRisks: [],
      notes: "Coherent.",
    },
    seasonality: {
      overallScore: score,
      primarySeasons: ["spring"],
      secondarySeasons: [],
      temperatureBandC: { min: 12, max: 22 },
      layeringSupport: "limited",
      weatherSuitability: ["dry"],
      weatherLimitations: [],
      notes: "Best in mild weather.",
    },
    colorAnalysis: {
      paletteType: "neutral",
      baseColors: ["white"],
      accentColors: [],
      targetAccentColor: null,
      accentColorUsage: "absent",
      contrastLevel: "medium",
      harmony: "cohesive",
      colorScore: score,
      notes: "Neutral.",
    },
    generatedOutfitAssessment: {
      providedOutfitCount: 0,
      overallScore: score,
      completeOutfitCount: 0,
      weakOutfitCount: 0,
      varietyScore: score,
      targetFitScore: score,
      roleCoverageScore: score,
      repetitionScore: score,
      strongestOutfitRefs: [],
      weakOutfits: [],
      notes: "No generated outfits.",
    },
    issues: [],
    suggestions: [],
    confidence: {
      overall: score,
      lowConfidenceAspects: [],
      assumptions: [],
    },
  };
}

function buildCompleteReport(score = 0.95): CapsuleReportLlmOutput {
  const report = buildReport(score);
  report.capsuleSummary.itemCount = 3;
  report.capsuleSummary.categoryCounts.bottom = 1;
  report.capsuleSummary.categoryCounts.shoes = 1;
  report.coverage.coreRoleCoverage.bottoms = "adequate";
  report.coverage.coreRoleCoverage.shoes = "adequate";
  return report;
}

describe("capsule report scoring", () => {
  test("preserves the LLM verdict and replaces verdict score and status", () => {
    const llmReport = buildCompleteReport(0.9);
    llmReport.verdict.score = 0.42;
    llmReport.verdict.status = "good";
    const report = applyComputedCapsuleVerdictScore(llmReport);

    expect(report.verdict).toMatchObject({
      llmScore: 0.42,
      llmStatus: "good",
      score: 0.9,
      status: "excellent",
    });
  });

  test("uses the LLM incomplete or incoherent status only for very low scores", () => {
    const incompleteReport = buildCompleteReport(0.25);
    incompleteReport.verdict.status = "incomplete";

    const incoherentReport = buildCompleteReport(0.25);
    incoherentReport.verdict.status = "incoherent";

    const offTargetReport = buildCompleteReport(0.25);
    offTargetReport.verdict.status = "off_target";

    expect(applyComputedCapsuleVerdictScore(incompleteReport).verdict).toEqual(
      expect.objectContaining({
        llmStatus: "incomplete",
        status: "incomplete",
      }),
    );
    expect(applyComputedCapsuleVerdictScore(incoherentReport).verdict).toEqual(
      expect.objectContaining({
        llmStatus: "incoherent",
        status: "incoherent",
      }),
    );
    expect(applyComputedCapsuleVerdictScore(offTargetReport).verdict).toEqual(
      expect.objectContaining({
        llmStatus: "off_target",
        status: "incomplete",
      }),
    );
  });

  test("applies issue, low-confidence, and balance penalties", () => {
    const report = buildCompleteReport(0.9);
    report.seasonality.overallScore = 0.3;
    report.confidence.overall = 0.6;
    report.issues = [
      {
        code: "LIMITED_SEASON",
        severity: "warning",
        dimension: "seasonality",
        message: "Seasonality is narrow.",
        affectedItemIds: [],
        suggestion: "Add a transitional layer.",
      },
      {
        code: "MINOR_NOTE",
        severity: "info",
        dimension: "coverage",
        message: "Coverage has a minor note.",
        affectedItemIds: [],
        suggestion: "Monitor coverage.",
      },
    ];

    expect(computeVerdictScore(report)).toBe(0.63);
  });

  test("caps otherwise high scoring reports with warning and critical issues", () => {
    const warningReport = buildCompleteReport();
    warningReport.issues = [
      {
        code: "WARNING",
        severity: "warning",
        dimension: "coverage",
        message: "Coverage has a warning.",
        affectedItemIds: [],
        suggestion: "Improve coverage.",
      },
    ];

    const criticalReport = buildCompleteReport();
    criticalReport.issues = [
      {
        code: "CRITICAL",
        severity: "critical",
        dimension: "coverage",
        message: "Coverage has a critical issue.",
        affectedItemIds: [],
        suggestion: "Fix coverage.",
      },
    ];

    expect(computeVerdictScore(warningReport)).toBe(0.89);
    expect(computeVerdictScore(criticalReport)).toBe(0.69);
  });

  test("caps high scoring reports by verdict status", () => {
    const incompleteReport = buildCompleteReport();
    incompleteReport.verdict.status = "incomplete";

    const offTargetReport = buildCompleteReport();
    offTargetReport.verdict.status = "off_target";

    const usableWithGapsReport = buildCompleteReport();
    usableWithGapsReport.verdict.status = "usable_with_gaps";

    expect(computeVerdictScore(incompleteReport)).toBe(0.59);
    expect(computeVerdictScore(offTargetReport)).toBe(0.69);
    expect(computeVerdictScore(usableWithGapsReport)).toBe(0.79);
  });

  test("caps reports with missing or thin core roles", () => {
    const missingShoesReport = buildCompleteReport();
    missingShoesReport.coverage.coreRoleCoverage.shoes = "missing";

    const missingBottomsReport = buildCompleteReport();
    missingBottomsReport.coverage.coreRoleCoverage.bottoms = "missing";

    const thinBottomsReport = buildCompleteReport();
    thinBottomsReport.coverage.coreRoleCoverage.bottoms = "thin";

    const thinShoesReport = buildCompleteReport();
    thinShoesReport.coverage.coreRoleCoverage.shoes = "thin";

    expect(computeVerdictScore(missingShoesReport)).toBe(0.59);
    expect(computeVerdictScore(missingBottomsReport)).toBe(0.59);
    expect(computeVerdictScore(thinBottomsReport)).toBe(0.79);
    expect(computeVerdictScore(thinShoesReport)).toBe(0.84);
  });

  test("caps reports when provided generated outfits are incomplete or weak", () => {
    const incompleteOutfitsReport = buildCompleteReport();
    incompleteOutfitsReport.generatedOutfitAssessment = {
      ...incompleteOutfitsReport.generatedOutfitAssessment,
      providedOutfitCount: 2,
      overallScore: 0.95,
      completeOutfitCount: 0,
      weakOutfitCount: 0,
    };

    const allWeakOutfitsReport = buildCompleteReport();
    allWeakOutfitsReport.generatedOutfitAssessment = {
      ...allWeakOutfitsReport.generatedOutfitAssessment,
      providedOutfitCount: 2,
      overallScore: 0.95,
      completeOutfitCount: 2,
      weakOutfitCount: 2,
    };

    expect(computeVerdictScore(incompleteOutfitsReport)).toBe(0.59);
    expect(computeVerdictScore(allWeakOutfitsReport)).toBe(0.74);
  });

  test("caps reports with low target, coverage, cohesion, or versatility scores", () => {
    const lowTargetReport = buildCompleteReport();
    lowTargetReport.targetAlignment.overallScore = 0.39;

    const weakCoverageReport = buildCompleteReport();
    weakCoverageReport.coverage.overallScore = 0.54;

    const weakCohesionReport = buildCompleteReport();
    weakCohesionReport.cohesion.overallScore = 0.44;

    const weakVersatilityReport = buildCompleteReport();
    weakVersatilityReport.versatility.overallScore = 0.44;

    expect(computeVerdictScore(lowTargetReport)).toBe(0.59);
    expect(computeVerdictScore(weakCoverageReport)).toBe(0.69);
    expect(computeVerdictScore(weakCohesionReport)).toBe(0.69);
    expect(computeVerdictScore(weakVersatilityReport)).toBe(0.74);
  });
});
