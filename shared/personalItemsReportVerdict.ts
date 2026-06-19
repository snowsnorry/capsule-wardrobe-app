type PersonalItemsReportVerdictStatus =
  | "excellent"
  | "good"
  | "usable_with_gaps"
  | "unbalanced"
  | "incomplete"
  | "unclear";

type PersonalItemsReportTone = "success" | "warning" | "error" | "neutral";

type PersonalItemsReportVerdictLike = {
  llmStatus?: unknown;
  score?: unknown;
  status?: unknown;
};

type PersonalItemsReportLike = {
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
): status is "incomplete" | "unclear" {
  const normalized = normalizeStatus(status);
  return normalized === "incomplete" || normalized === "unclear";
}

function getPersonalItemsReportVerdictStatusForScore(
  score: unknown,
  llmStatus?: unknown,
): PersonalItemsReportVerdictStatus | null {
  const normalizedScore = normalizeScore(score);
  if (normalizedScore === null) {
    return null;
  }

  if (normalizedScore >= 0.9) return "excellent";
  if (normalizedScore >= 0.75) return "good";
  if (normalizedScore >= 0.6) return "usable_with_gaps";
  if (normalizedScore >= 0.4) return "unbalanced";
  if (isLowScoreLlmStatus(llmStatus)) return llmStatus;
  return "incomplete";
}

function getPersonalItemsReportVerdictToneForScore(
  score: unknown,
  llmStatus?: unknown,
): PersonalItemsReportTone {
  const status = getPersonalItemsReportVerdictStatusForScore(score, llmStatus);
  if (!status) return "neutral";
  if (status === "excellent" || status === "good") return "success";
  if (status === "usable_with_gaps") return "warning";
  return "error";
}

function normalizePersonalItemsReportVerdictForDisplay<
  Verdict extends PersonalItemsReportVerdictLike,
>(verdict: Verdict): Verdict {
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) {
    return verdict;
  }

  const llmStatus = normalizeStatus(verdict.llmStatus || verdict.status);
  const status = getPersonalItemsReportVerdictStatusForScore(
    verdict.score,
    llmStatus,
  );

  return {
    ...verdict,
    ...(llmStatus ? { llmStatus } : {}),
    ...(status ? { status } : {}),
  };
}

function normalizePersonalItemsReportForDisplay<
  Report extends PersonalItemsReportLike,
>(report: Report | null | undefined): Report | null {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return report || null;
  }

  const verdict =
    report.verdict && typeof report.verdict === "object"
      ? normalizePersonalItemsReportVerdictForDisplay(
          report.verdict as PersonalItemsReportVerdictLike,
        )
      : report.verdict;

  return {
    ...report,
    verdict,
  };
}

export {
  getPersonalItemsReportVerdictStatusForScore,
  getPersonalItemsReportVerdictToneForScore,
  normalizePersonalItemsReportForDisplay,
  normalizePersonalItemsReportVerdictForDisplay,
};
