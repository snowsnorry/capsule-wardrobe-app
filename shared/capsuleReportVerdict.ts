type CapsuleReportVerdictStatus =
  | "excellent"
  | "good"
  | "usable_with_gaps"
  | "off_target"
  | "incomplete"
  | "incoherent";

type CapsuleReportTone = "success" | "warning" | "error" | "neutral";

type CapsuleReportVerdictLike = {
  llmStatus?: unknown;
  score?: unknown;
  status?: unknown;
};

type CapsuleReportLike = {
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

function getCapsuleReportVerdictStatusForScore(
  score: unknown,
  llmStatus?: unknown,
): CapsuleReportVerdictStatus | null {
  const normalizedScore = normalizeScore(score);
  if (normalizedScore === null) {
    return null;
  }

  if (normalizedScore >= 0.9) return "excellent";
  if (normalizedScore >= 0.75) return "good";
  if (normalizedScore >= 0.6) return "usable_with_gaps";
  if (normalizedScore >= 0.4) return "off_target";
  if (isLowScoreLlmStatus(llmStatus)) return llmStatus;
  return "incomplete";
}

function getCapsuleReportVerdictToneForScore(
  score: unknown,
  llmStatus?: unknown,
): CapsuleReportTone {
  const status = getCapsuleReportVerdictStatusForScore(score, llmStatus);
  if (!status) return "neutral";
  if (status === "excellent" || status === "good") return "success";
  if (status === "usable_with_gaps") return "warning";
  return "error";
}

function normalizeCapsuleReportVerdictForDisplay<
  Verdict extends CapsuleReportVerdictLike,
>(verdict: Verdict): Verdict {
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) {
    return verdict;
  }

  const llmStatus = normalizeStatus(verdict.llmStatus || verdict.status);
  const status = getCapsuleReportVerdictStatusForScore(
    verdict.score,
    llmStatus,
  );

  return {
    ...verdict,
    ...(llmStatus ? { llmStatus } : {}),
    ...(status ? { status } : {}),
  };
}

function normalizeCapsuleReportForDisplay<Report extends CapsuleReportLike>(
  report: Report | null | undefined,
): Report | null {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return report || null;
  }

  const verdict =
    report.verdict && typeof report.verdict === "object"
      ? normalizeCapsuleReportVerdictForDisplay(
          report.verdict as CapsuleReportVerdictLike,
        )
      : report.verdict;

  return {
    ...report,
    verdict,
  };
}

export {
  getCapsuleReportVerdictStatusForScore,
  getCapsuleReportVerdictToneForScore,
  normalizeCapsuleReportForDisplay,
  normalizeCapsuleReportVerdictForDisplay,
};
export type { CapsuleReportTone, CapsuleReportVerdictStatus };
