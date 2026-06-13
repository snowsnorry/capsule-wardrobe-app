import type {
  CapsuleReport,
  CapsuleReportLlmOutput,
} from "./capsuleReportTypes.js";

function applyComputedCapsuleVerdictScore(
  report: CapsuleReportLlmOutput,
): Omit<CapsuleReport, "schemaVersion" | "itemsHash"> {
  const llmScore = report.verdict.score;
  return {
    ...report,
    verdict: {
      ...report.verdict,
      llmScore,
      score: llmScore,
    },
  };
}

export { applyComputedCapsuleVerdictScore };
