import type {
  CapsuleReport,
  CapsuleReportLlmOutput,
} from "./capsuleReportTypes.js";

type IssueSeverity = "info" | "warning" | "critical";
type ScorableCapsuleReport = CapsuleReportLlmOutput | CapsuleReport;

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

function getCapsuleDimensionScores(
  report: ScorableCapsuleReport,
): WeightedScore[] {
  const scores: WeightedScore[] = [
    {
      value: report.targetAlignment.overallScore,
      weight: 0.22,
    },
    {
      value: report.coverage.overallScore,
      weight: 0.18,
    },
    {
      value: report.versatility.overallScore,
      weight: 0.17,
    },
    {
      value: report.cohesion.overallScore,
      weight: 0.16,
    },
    {
      value: report.seasonality.overallScore,
      weight: 0.12,
    },
    {
      value: report.colorAnalysis.colorScore,
      weight: 0.1,
    },
  ];

  if (report.generatedOutfitAssessment.providedOutfitCount > 0) {
    scores.push({
      value: report.generatedOutfitAssessment.overallScore,
      weight: 0.05,
    });
  }

  return scores;
}

function computeBalancePenalty(
  scores: WeightedScore[],
  baseScore: number,
): number {
  const weakestScore = Math.min(...scores.map((score) => clamp01(score.value)));
  return 0.22 * Math.max(0, baseScore - weakestScore);
}

function computeStatusScoreCap(report: ScorableCapsuleReport): number {
  if (
    report.verdict.status === "incomplete" ||
    report.verdict.status === "incoherent"
  ) {
    return 0.59;
  }

  if (report.verdict.status === "off_target") {
    return 0.69;
  }

  if (report.verdict.status === "usable_with_gaps") {
    return 0.79;
  }

  return 1;
}

function computeIssueScoreCap(report: ScorableCapsuleReport): number {
  const hasCritical = report.issues.some(
    (issue) => issue.severity === "critical",
  );

  if (hasCritical) {
    return 0.69;
  }

  const hasWarning = report.issues.some(
    (issue) => issue.severity === "warning",
  );

  if (hasWarning) {
    return 0.89;
  }

  return 1;
}

function computeCoreRoleScoreCap(report: ScorableCapsuleReport): number {
  const { tops, bottoms, shoes } = report.coverage.coreRoleCoverage;
  const hasDress = report.capsuleSummary.categoryCounts.dress > 0;

  if (shoes === "missing") {
    return 0.59;
  }

  if (!hasDress && (tops === "missing" || bottoms === "missing")) {
    return 0.59;
  }

  if (!hasDress && (tops === "thin" || bottoms === "thin")) {
    return 0.79;
  }

  if (shoes === "thin") {
    return 0.84;
  }

  return 1;
}

function computeGeneratedOutfitScoreCap(report: ScorableCapsuleReport): number {
  const { providedOutfitCount, completeOutfitCount, weakOutfitCount } =
    report.generatedOutfitAssessment;

  if (providedOutfitCount === 0) {
    return 1;
  }

  if (completeOutfitCount === 0) {
    return 0.59;
  }

  if (weakOutfitCount >= providedOutfitCount) {
    return 0.74;
  }

  return 1;
}

function computeLowDimensionScoreCap(report: ScorableCapsuleReport): number {
  const targetScore = report.targetAlignment.overallScore;
  const coverageScore = report.coverage.overallScore;
  const cohesionScore = report.cohesion.overallScore;
  const versatilityScore = report.versatility.overallScore;

  if (targetScore < 0.4 || coverageScore < 0.4) {
    return 0.59;
  }

  if (targetScore < 0.55 || coverageScore < 0.55) {
    return 0.69;
  }

  if (cohesionScore < 0.45) {
    return 0.69;
  }

  if (versatilityScore < 0.45) {
    return 0.74;
  }

  return 1;
}

function computeVerdictScore(report: ScorableCapsuleReport): number {
  const dimensionScores = getCapsuleDimensionScores(report);
  const baseScore = computeWeightedAverage(dimensionScores);

  const balancePenalty = computeBalancePenalty(dimensionScores, baseScore);
  const issuePenalty = computeIssuePenalty(report.issues);
  const confidencePenalty = computeConfidencePenalty(report.confidence.overall);

  let finalScore =
    baseScore - balancePenalty - issuePenalty - confidencePenalty;

  finalScore = Math.min(
    finalScore,
    computeStatusScoreCap(report),
    computeIssueScoreCap(report),
    computeCoreRoleScoreCap(report),
    computeGeneratedOutfitScoreCap(report),
    computeLowDimensionScoreCap(report),
  );

  return roundTo2(clamp01(finalScore));
}

function applyComputedCapsuleVerdictScore(
  report: CapsuleReportLlmOutput,
): Omit<CapsuleReport, "schemaVersion" | "itemsHash"> {
  const llmScore = report.verdict.score;

  return {
    ...report,
    verdict: {
      ...report.verdict,
      llmScore,
      score: computeVerdictScore(report),
    },
  };
}

export { applyComputedCapsuleVerdictScore, computeVerdictScore };
