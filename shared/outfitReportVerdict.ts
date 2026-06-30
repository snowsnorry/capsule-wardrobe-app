type OutfitReportVerdictStatus =
  "valid" | "acceptable_with_notes" | "incomplete" | "incoherent";

type OutfitReportTone = "success" | "warning" | "error" | "neutral";

type OutfitReportVerdictLike = {
  llmStatus?: unknown;
  score?: unknown;
  status?: unknown;
};

type OutfitReportLike = {
  verdict?: unknown;
};

function normalizeScore(score: unknown): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }

  return Math.max(0, Math.min(1, score));
}

function normalizeStatus(status: unknown): string {
  return typeof status === "string" ? status.trim() : "";
}

function isLowScoreLlmStatus(
  status: unknown,
): status is "incomplete" | "incoherent" {
  const normalized = normalizeStatus(status);
  return normalized === "incomplete" || normalized === "incoherent";
}

function getOutfitReportVerdictStatusForScore(
  score: unknown,
  llmStatus?: unknown,
): OutfitReportVerdictStatus | null {
  const normalizedScore = normalizeScore(score);
  if (normalizedScore === null) {
    return null;
  }

  if (normalizedScore >= 0.75) return "valid";
  if (normalizedScore >= 0.6) return "acceptable_with_notes";
  if (isLowScoreLlmStatus(llmStatus)) return llmStatus;
  return "incomplete";
}

function getOutfitReportVerdictToneForScore(
  score: unknown,
  llmStatus?: unknown,
): OutfitReportTone {
  const status = getOutfitReportVerdictStatusForScore(score, llmStatus);
  if (!status) return "neutral";
  if (status === "valid") return "success";
  if (status === "acceptable_with_notes") return "warning";
  return "error";
}

function normalizeOutfitReportVerdictForDisplay<
  Verdict extends OutfitReportVerdictLike,
>(verdict: Verdict): Verdict {
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) {
    return verdict;
  }

  const llmStatus = normalizeStatus(verdict.llmStatus || verdict.status);
  const status = getOutfitReportVerdictStatusForScore(verdict.score, llmStatus);

  return {
    ...verdict,
    ...(llmStatus ? { llmStatus } : {}),
    ...(status ? { status } : {}),
  };
}

function normalizeOutfitReportForDisplay<Report extends OutfitReportLike>(
  report: Report | null | undefined,
): Report | null {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return report || null;
  }

  const verdict =
    report.verdict && typeof report.verdict === "object"
      ? normalizeOutfitReportVerdictForDisplay(
          report.verdict as OutfitReportVerdictLike,
        )
      : report.verdict;

  return {
    ...report,
    verdict,
  };
}

export {
  getOutfitReportVerdictStatusForScore,
  getOutfitReportVerdictToneForScore,
  normalizeOutfitReportForDisplay,
  normalizeOutfitReportVerdictForDisplay,
};
