import { describe, expect, test } from "vitest";
import { applyComputedCapsuleVerdictScore } from "./capsuleReportScoring.js";
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

describe("capsule report scoring", () => {
  test("preserves the LLM score and uses it as the computed score for now", () => {
    const report = applyComputedCapsuleVerdictScore(buildReport(0.73));

    expect(report.verdict).toMatchObject({
      llmScore: 0.73,
      score: 0.73,
      status: "good",
    });
  });
});
