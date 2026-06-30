import type {
  PersonalItemsReport,
  PersonalItemsReportLlmOutput,
  PersonalItemsReportSeverity,
} from "./personalItemsReportTypes.js";
import { getPersonalItemsReportVerdictStatusForScore } from "../../../shared/personalItemsReportVerdict.js";

type CoverageLevel =
  | "missing"
  | "thin"
  | "adequate"
  | "strong"
  | "overrepresented"
  | "not_applicable";
type ScorablePersonalItemsReport =
  PersonalItemsReportLlmOutput | PersonalItemsReport;

type WeightedScore = {
  value: number;
  weight: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeWeightedAverage(scores: WeightedScore[]): number {
  const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  const weightedSum = scores.reduce(
    (sum, score) => sum + clamp01(score.value) * score.weight,
    0,
  );

  return weightedSum / totalWeight;
}

function computeIssuePenalty(
  issues: Array<{ severity: PersonalItemsReportSeverity }>,
): number {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "critical") return sum + 0.16;
    if (issue.severity === "warning") return sum + 0.05;
    return sum + 0.01;
  }, 0);

  return Math.min(penalty, 0.3);
}

function computeConfidencePenalty(confidenceOverall: number): number {
  if (confidenceOverall >= 0.75) return 0;
  return (0.75 - confidenceOverall) * 0.1;
}

function getPersonalItemsDimensionScores(
  report: ScorablePersonalItemsReport,
): WeightedScore[] {
  return [
    { value: report.scores.outfitReadiness, weight: 0.22 },
    { value: report.scores.coverage, weight: 0.2 },
    { value: report.scores.versatility, weight: 0.16 },
    { value: report.scores.seasonality, weight: 0.12 },
    { value: report.scores.efficiency, weight: 0.12 },
    { value: report.scores.colorHarmony, weight: 0.1 },
    { value: report.scores.styleClarity, weight: 0.08 },
  ];
}

function computeBalancePenalty(
  scores: WeightedScore[],
  baseScore: number,
): number {
  const weakestScore = Math.min(...scores.map((score) => clamp01(score.value)));
  return 0.22 * Math.max(0, baseScore - weakestScore);
}

function computeStatusScoreCap(report: ScorablePersonalItemsReport): number {
  if (
    report.verdict.status === "incomplete" ||
    report.verdict.status === "unclear"
  ) {
    return 0.59;
  }

  if (report.verdict.status === "unbalanced") {
    return 0.69;
  }

  if (report.verdict.status === "usable_with_gaps") {
    return 0.79;
  }

  return 1;
}

function computeIssueScoreCap(report: ScorablePersonalItemsReport): number {
  if (report.issues.some((issue) => issue.severity === "critical")) {
    return 0.69;
  }

  if (report.issues.some((issue) => issue.severity === "warning")) {
    return 0.89;
  }

  return 1;
}

function isUsableCoverage(level: string): boolean {
  return ["thin", "adequate", "strong"].includes(level as CoverageLevel);
}

function computeSeparateRoleScoreCap({
  bottoms,
  hasUsableDressPath,
  tops,
}: {
  bottoms: string;
  hasUsableDressPath: boolean;
  tops: string;
}) {
  const hasMissingSeparateRole = tops === "missing" || bottoms === "missing";
  const hasThinSeparateRole = tops === "thin" || bottoms === "thin";

  if (!hasUsableDressPath && hasMissingSeparateRole) return 0.59;
  if (!hasUsableDressPath && hasThinSeparateRole) return 0.79;

  return 1;
}

function computeDressPathScoreCap({
  dresses,
  hasMissingSeparateRole,
  hasUsableDressPath,
}: {
  dresses: string;
  hasMissingSeparateRole: boolean;
  hasUsableDressPath: boolean;
}) {
  if (hasUsableDressPath && dresses === "thin" && hasMissingSeparateRole) {
    return 0.79;
  }

  return 1;
}

function computeCoreRoleScoreCap(report: ScorablePersonalItemsReport): number {
  const { tops, bottoms, shoes, dresses } = report.coverage.coreRoleCoverage;
  const hasDressItems = report.personalItemsOverview.categoryCounts.dress > 0;
  const hasUsableDressPath = hasDressItems && isUsableCoverage(dresses);
  const hasMissingSeparateRole = tops === "missing" || bottoms === "missing";
  const shoesCap = shoes === "missing" ? 0.59 : shoes === "thin" ? 0.84 : 1;

  return Math.min(
    shoesCap,
    computeSeparateRoleScoreCap({ bottoms, hasUsableDressPath, tops }),
    computeDressPathScoreCap({
      dresses,
      hasMissingSeparateRole,
      hasUsableDressPath,
    }),
  );
}

function computeOutfitReadinessScoreCap(
  report: ScorablePersonalItemsReport,
): number {
  const { estimatedOutfitRange, overallScore, supportedFormulaTypes } =
    report.outfitReadiness;
  const hasCoreFormula = supportedFormulaTypes.some(
    (type) => type === "top_bottom_shoes" || type === "dress_shoes",
  );

  if (overallScore < 0.4) return 0.59;
  if (!hasCoreFormula) return 0.59;
  if (estimatedOutfitRange.max !== null && estimatedOutfitRange.max <= 0) {
    return 0.59;
  }
  if (overallScore < 0.55) return 0.69;
  if (overallScore < 0.65) return 0.79;

  return 1;
}

function computeCategoryBalanceScoreCap(
  report: ScorablePersonalItemsReport,
): number {
  const { detectedCategoryBalance } = report.personalItemsOverview;

  if (detectedCategoryBalance === "fragmented") return 0.74;
  if (detectedCategoryBalance === "shoe_limited") return 0.84;
  if (
    detectedCategoryBalance === "top_heavy" ||
    detectedCategoryBalance === "bottom_heavy" ||
    detectedCategoryBalance === "outerwear_heavy" ||
    detectedCategoryBalance === "accessory_heavy"
  ) {
    return 0.89;
  }

  return 1;
}

function computeLowDimensionScoreCap(
  report: ScorablePersonalItemsReport,
): number {
  const { coverage, outfitReadiness, versatility, seasonality, efficiency } =
    report.scores;

  if (coverage < 0.4 || outfitReadiness < 0.4) return 0.59;
  if (coverage < 0.55 || outfitReadiness < 0.55) return 0.69;
  if (versatility < 0.45 || efficiency < 0.45) return 0.74;
  if (seasonality < 0.4) return 0.79;

  return 1;
}

function computeConfidenceScoreCap(
  report: ScorablePersonalItemsReport,
): number {
  if (report.confidence.overall < 0.35) return 0.59;
  if (report.confidence.overall < 0.5) return 0.69;

  return 1;
}

function computeVerdictScore(report: ScorablePersonalItemsReport): number {
  const dimensionScores = getPersonalItemsDimensionScores(report);
  const baseScore = computeWeightedAverage(dimensionScores);

  let finalScore =
    baseScore -
    computeBalancePenalty(dimensionScores, baseScore) -
    computeIssuePenalty(report.issues) -
    computeConfidencePenalty(report.confidence.overall);

  finalScore = Math.min(
    finalScore,
    computeStatusScoreCap(report),
    computeIssueScoreCap(report),
    computeCoreRoleScoreCap(report),
    computeOutfitReadinessScoreCap(report),
    computeCategoryBalanceScoreCap(report),
    computeLowDimensionScoreCap(report),
    computeConfidenceScoreCap(report),
  );

  return roundTo2(clamp01(finalScore));
}

function applyComputedPersonalItemsVerdictScore(
  report: PersonalItemsReportLlmOutput,
): Omit<PersonalItemsReport, "schemaVersion"> {
  const llmScore = report.verdict.score;
  const llmStatus = report.verdict.status;
  const score = computeVerdictScore(report);

  return {
    ...report,
    verdict: {
      ...report.verdict,
      llmScore,
      llmStatus,
      score,
      status:
        getPersonalItemsReportVerdictStatusForScore(score, llmStatus) ||
        llmStatus,
    },
  };
}

export { applyComputedPersonalItemsVerdictScore, computeVerdictScore };
