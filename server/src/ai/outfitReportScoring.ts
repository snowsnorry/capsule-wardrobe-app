import type {
  OutfitReport,
  OutfitReportLlmOutput,
} from "./outfitReportTypes.js";
import { getOutfitReportVerdictStatusForScore } from "../../../shared/outfitReportVerdict.js";

type IssueSeverity = "info" | "warning" | "critical";
type ScorableOutfitReport = OutfitReportLlmOutput | OutfitReport;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeCompositionScore(report: ScorableOutfitReport): number {
  const { completeness, missingCoreRoles, extraRoles } = report.composition;

  let score = 1;

  for (const role of missingCoreRoles) {
    if (role === "footwear") score -= 0.35;
    else if (role === "base_top") score -= 0.25;
    else if (role === "bottom") score -= 0.25;
    else if (role === "dress_one_piece") score -= 0.35;
  }

  score -= Math.min(extraRoles.length * 0.05, 0.15);

  if (completeness === "partial") {
    score = Math.min(score, 0.65);
  }

  if (completeness === "overbuilt") {
    score = Math.min(score, 0.85);
  }

  return clamp01(score);
}

function computeIssuePenalty(
  issues: Array<{ severity: IssueSeverity }>,
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

function computeVerdictScore(report: ScorableOutfitReport): number {
  const compositionScore = computeCompositionScore(report);

  const scores = {
    style: report.styleProfile.styleScore,
    season: report.seasonality.seasonScore,
    color: report.colorAnalysis.colorScore,
    composition: compositionScore,
    formality: report.compatibility.formalityCoherence,
  };

  const baseScore =
    0.25 * scores.style +
    0.23 * scores.season +
    0.22 * scores.color +
    0.15 * scores.composition +
    0.15 * scores.formality;

  const weakestScore = Math.min(
    scores.style,
    scores.season,
    scores.color,
    scores.composition,
    scores.formality,
  );

  const balancePenalty = 0.25 * Math.max(0, baseScore - weakestScore);
  const issuePenalty = computeIssuePenalty(report.issues);
  const confidencePenalty = computeConfidencePenalty(report.confidence.overall);

  let finalScore =
    baseScore - balancePenalty - issuePenalty - confidencePenalty;

  const hasWarning = report.issues.some(
    (issue) => issue.severity === "warning",
  );
  const hasCritical = report.issues.some(
    (issue) => issue.severity === "critical",
  );

  if (report.composition.completeness === "partial") {
    finalScore = Math.min(finalScore, 0.59);
  }

  if (report.composition.completeness === "overbuilt") {
    finalScore = Math.min(finalScore, 0.84);
  }

  if (hasCritical) {
    finalScore = Math.min(finalScore, 0.69);
  }

  if (hasWarning) {
    finalScore = Math.min(finalScore, 0.89);
  }

  return roundTo2(clamp01(finalScore));
}

function applyComputedVerdictScore(
  report: OutfitReportLlmOutput,
): Omit<OutfitReport, "schemaVersion" | "itemsHash"> {
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
        getOutfitReportVerdictStatusForScore(score, llmStatus) || llmStatus,
    },
  };
}

export { applyComputedVerdictScore, computeVerdictScore };
