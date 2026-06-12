import type {
  OutfitReport,
  OutfitReportIssue,
  OutfitReportSuggestion,
} from "../../app/appTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function toPercent(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
}

export function formatReportValue(value: unknown) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getReportScore(report: OutfitReport) {
  return toPercent(report.verdict?.score ?? report.compatibility?.overallScore);
}

export function getReportTemperatureLabel(report: OutfitReport, t: Translate) {
  const { max, min } = report.seasonality?.temperatureBandC || {};

  if (min != null && max != null) {
    return t("outfit.reportTemperatureRange", { max, min });
  }
  if (min != null) {
    return t("outfit.reportTemperatureFrom", { min });
  }
  if (max != null) {
    return t("outfit.reportTemperatureUpTo", { max });
  }
  return null;
}

export function getReportChipValues(report: OutfitReport) {
  return [
    ...(report.seasonality?.primarySeasons || []),
    report.styleProfile?.formalityLevel,
    report.styleProfile?.primaryStyle,
    report.colorAnalysis?.paletteType,
  ].filter((value): value is string => Boolean(value));
}

export function getReportScoreRows(report: OutfitReport, t: Translate) {
  return [
    {
      key: "style",
      label: t("outfit.reportScoreStyleCoherence"),
      value:
        report.compatibility?.styleCoherence ?? report.styleProfile?.styleScore,
    },
    {
      key: "color",
      label: t("outfit.reportScoreColorHarmony"),
      value:
        report.compatibility?.colorCoherence ??
        report.colorAnalysis?.colorScore,
    },
    {
      key: "season",
      label: t("outfit.reportScoreSeasonFit"),
      value:
        report.compatibility?.seasonalCoherence ??
        report.seasonality?.seasonScore,
    },
    {
      key: "formality",
      label: t("outfit.reportScoreFormalityCoherence"),
      value: report.compatibility?.formalityCoherence,
    },
    {
      key: "overall",
      label: t("outfit.reportScoreOverallCompatibility"),
      value: report.compatibility?.overallScore,
    },
  ]
    .map((row) => ({ ...row, percent: toPercent(row.value) }))
    .filter((row) => row.percent !== null);
}

export function getReportVerdictLabel(report: OutfitReport, t: Translate) {
  const status = String(report.verdict?.status || "").trim();
  return status
    ? t(`outfit.reportVerdict.${status}`)
    : t("outfit.reportVerdict.valid");
}

export function getReportIssueIds(issue: OutfitReportIssue) {
  return (issue.affectedItemIds || []).filter(Boolean);
}

export function getReportSuggestionIds(suggestion: OutfitReportSuggestion) {
  return (suggestion.targetItemIds || []).filter(Boolean);
}

export type { Translate as OutfitReportTranslate };
