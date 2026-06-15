import { describe, expect, test } from "vitest";
import {
  applyComputedVerdictScore,
  computeVerdictScore,
} from "./outfitReportScoring.js";
import type { OutfitReportLlmOutput } from "./outfitReportTypes.js";

type ReportOverrides = Omit<
  Partial<OutfitReportLlmOutput>,
  | "colorAnalysis"
  | "compatibility"
  | "composition"
  | "confidence"
  | "seasonality"
  | "styleProfile"
  | "verdict"
> & {
  colorAnalysis?: Partial<OutfitReportLlmOutput["colorAnalysis"]>;
  compatibility?: Partial<OutfitReportLlmOutput["compatibility"]>;
  composition?: Partial<OutfitReportLlmOutput["composition"]>;
  confidence?: Partial<OutfitReportLlmOutput["confidence"]>;
  seasonality?: Partial<OutfitReportLlmOutput["seasonality"]>;
  styleProfile?: Partial<OutfitReportLlmOutput["styleProfile"]>;
  verdict?: Partial<OutfitReportLlmOutput["verdict"]>;
};

function buildReport(overrides: ReportOverrides = {}): OutfitReportLlmOutput {
  const report: OutfitReportLlmOutput = {
    verdict: {
      status: "valid",
      score: 0.42,
      summary: "Ready.",
    },
    composition: {
      itemCount: 3,
      categoryCounts: {
        top: 1,
        bottom: 1,
        midlayer: 0,
        outerwear: 0,
        dress: 0,
        shoes: 1,
        bag: 0,
        belt: 0,
        swimwear: 0,
        other: 0,
      },
      detectedRoles: ["base_top", "bottom", "footwear"],
      missingCoreRoles: [],
      extraRoles: [],
      completeness: "complete",
    },
    seasonality: {
      primarySeasons: ["spring"],
      secondarySeasons: [],
      temperatureBandC: { min: 12, max: 22 },
      weatherSuitability: ["dry"],
      weatherLimitations: [],
      seasonScore: 0.9,
    },
    styleProfile: {
      primaryStyle: "minimalistic",
      secondaryStyles: [],
      formalityLevel: "casual",
      occasions: ["everyday_errands"],
      styleKeywords: ["clean"],
      styleScore: 0.9,
    },
    compatibility: {
      overallScore: 0.9,
      styleCoherence: 0.9,
      formalityCoherence: 0.9,
      seasonalCoherence: 0.9,
      colorCoherence: 0.9,
      mainStrengths: [],
      mainRisks: [],
    },
    colorAnalysis: {
      paletteType: "neutral",
      dominantColors: ["white"],
      accentColors: [],
      contrastLevel: "medium",
      harmony: "cohesive",
      colorScore: 0.9,
      notes: "Neutral palette.",
    },
    issues: [],
    suggestions: [],
    confidence: {
      overall: 0.9,
      lowConfidenceAspects: [],
      assumptions: [],
    },
  };

  return {
    ...report,
    ...overrides,
    verdict: { ...report.verdict, ...overrides.verdict },
    composition: { ...report.composition, ...overrides.composition },
    seasonality: { ...report.seasonality, ...overrides.seasonality },
    styleProfile: { ...report.styleProfile, ...overrides.styleProfile },
    compatibility: { ...report.compatibility, ...overrides.compatibility },
    colorAnalysis: { ...report.colorAnalysis, ...overrides.colorAnalysis },
    confidence: { ...report.confidence, ...overrides.confidence },
  };
}

describe("outfit report scoring", () => {
  test("preserves the LLM verdict and replaces verdict score and status", () => {
    expect(applyComputedVerdictScore(buildReport())).toMatchObject({
      verdict: {
        llmScore: 0.42,
        llmStatus: "valid",
        score: 0.91,
        status: "valid",
      },
    });
  });

  test("uses the LLM incomplete or incoherent status only for low scores", () => {
    expect(
      applyComputedVerdictScore(
        buildReport({
          verdict: { status: "incomplete" },
          compatibility: {
            overallScore: 0.5,
            styleCoherence: 0.5,
            formalityCoherence: 0.5,
            seasonalCoherence: 0.5,
            colorCoherence: 0.5,
          },
          colorAnalysis: { colorScore: 0.5 },
          seasonality: { seasonScore: 0.5 },
          styleProfile: { styleScore: 0.5 },
        }),
      ).verdict,
    ).toEqual(
      expect.objectContaining({
        llmStatus: "incomplete",
        status: "incomplete",
      }),
    );

    expect(
      applyComputedVerdictScore(
        buildReport({
          verdict: { status: "incoherent" },
          compatibility: {
            overallScore: 0.5,
            styleCoherence: 0.5,
            formalityCoherence: 0.5,
            seasonalCoherence: 0.5,
            colorCoherence: 0.5,
          },
          colorAnalysis: { colorScore: 0.5 },
          seasonality: { seasonScore: 0.5 },
          styleProfile: { styleScore: 0.5 },
        }),
      ).verdict,
    ).toEqual(
      expect.objectContaining({
        llmStatus: "incoherent",
        status: "incoherent",
      }),
    );

    expect(
      applyComputedVerdictScore(
        buildReport({
          verdict: { status: "valid" },
          compatibility: {
            overallScore: 0.5,
            styleCoherence: 0.5,
            formalityCoherence: 0.5,
            seasonalCoherence: 0.5,
            colorCoherence: 0.5,
          },
          colorAnalysis: { colorScore: 0.5 },
          seasonality: { seasonScore: 0.5 },
          styleProfile: { styleScore: 0.5 },
        }),
      ).verdict,
    ).toEqual(
      expect.objectContaining({
        llmStatus: "valid",
        status: "incomplete",
      }),
    );
  });

  test("penalizes missing core roles, partial reports, critical issues, and low confidence", () => {
    expect(
      computeVerdictScore(
        buildReport({
          composition: {
            missingCoreRoles: [
              "footwear",
              "base_top",
              "bottom",
              "dress_one_piece",
            ],
            extraRoles: ["bag", "waist_accessory", "outer_layer", "mid_layer"],
            completeness: "partial",
          },
          issues: [
            {
              code: "MISSING_CORE",
              severity: "critical",
              dimension: "composition",
              message: "Core role missing.",
              affectedItemIds: [],
              suggestion: "Add the missing item.",
            },
          ],
          confidence: { overall: 0.6 },
        }),
      ),
    ).toBe(0.4);
  });

  test("caps overbuilt reports and applies warning plus info penalties", () => {
    expect(
      computeVerdictScore(
        buildReport({
          composition: {
            extraRoles: ["outer_layer"],
            completeness: "overbuilt",
          },
          issues: [
            {
              code: "TOO_MUCH",
              severity: "warning",
              dimension: "composition",
              message: "Too much layering.",
              affectedItemIds: [],
              suggestion: "Remove a layer.",
            },
            {
              code: "MINOR_NOTE",
              severity: "info",
              dimension: "style",
              message: "Minor note.",
              affectedItemIds: [],
              suggestion: "Keep it in mind.",
            },
          ],
          seasonality: { seasonScore: 1 },
          styleProfile: { styleScore: 1 },
          compatibility: { formalityCoherence: 1 },
          colorAnalysis: { colorScore: 1 },
        }),
      ),
    ).toBe(0.84);
  });

  test("caps otherwise high-scoring reports with warnings and critical issue penalty totals", () => {
    const highScoringReport = buildReport({
      seasonality: { seasonScore: 1 },
      styleProfile: { styleScore: 1 },
      compatibility: { formalityCoherence: 1 },
      colorAnalysis: { colorScore: 1 },
    });

    expect(
      computeVerdictScore({
        ...highScoringReport,
        issues: [
          {
            code: "WARNING",
            severity: "warning",
            dimension: "style",
            message: "Warning.",
            affectedItemIds: [],
            suggestion: "Adjust styling.",
          },
        ],
      }),
    ).toBe(0.89);

    expect(
      computeVerdictScore({
        ...highScoringReport,
        issues: Array.from({ length: 3 }, (_, index) => ({
          code: `CRITICAL_${index}`,
          severity: "critical" as const,
          dimension: "practicality",
          message: "Critical issue.",
          affectedItemIds: [],
          suggestion: "Fix it.",
        })),
      }),
    ).toBe(0.69);
  });
});
