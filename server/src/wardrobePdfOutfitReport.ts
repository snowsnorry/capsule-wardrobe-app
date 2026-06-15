import { t } from "../../shared/i18n/helpers.js";
import {
  getOutfitReportVerdictStatusForScore,
  getOutfitReportVerdictToneForScore,
} from "../../shared/outfitReportVerdict.js";
import {
  ERROR_COLOR,
  ERROR_WASH_COLOR,
  NEUTRAL_WASH_COLOR,
  SECONDARY_COLOR,
  SUCCESS_COLOR,
  SUCCESS_WASH_COLOR,
  WARNING_COLOR,
  WARNING_WASH_COLOR,
} from "./wardrobePdfOutfitConstants.js";

export function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function toPercent(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
}

export function formatReportValue(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getReportScore(report) {
  return toPercent(
    report?.verdict?.score ?? report?.compatibility?.overallScore,
  );
}

export function getScoreTone(score) {
  if (score === null) return "neutral";
  return getOutfitReportVerdictToneForScore(score / 100);
}

export function getToneColors(tone) {
  if (tone === "success") {
    return { color: SUCCESS_COLOR, wash: SUCCESS_WASH_COLOR };
  }
  if (tone === "warning") {
    return { color: WARNING_COLOR, wash: WARNING_WASH_COLOR };
  }
  if (tone === "error") {
    return { color: ERROR_COLOR, wash: ERROR_WASH_COLOR };
  }
  return { color: SECONDARY_COLOR, wash: NEUTRAL_WASH_COLOR };
}

export function getReportTemperatureLabel(report, locale) {
  const { max, min } = report?.seasonality?.temperatureBandC || {};

  if (min != null && max != null) {
    return t("outfit.reportTemperatureRange", { max, min }, locale);
  }
  if (min != null) {
    return t("outfit.reportTemperatureFrom", { min }, locale);
  }
  if (max != null) {
    return t("outfit.reportTemperatureUpTo", { max }, locale);
  }
  return null;
}

export function getReportChipValues(report, locale) {
  return [
    getReportTemperatureLabel(report, locale),
    ...(report?.seasonality?.primarySeasons || []),
    report?.styleProfile?.formalityLevel,
    report?.styleProfile?.primaryStyle,
    report?.colorAnalysis?.paletteType,
  ].filter(Boolean);
}

function getStyleScore(report) {
  return (
    report?.compatibility?.styleCoherence ?? report?.styleProfile?.styleScore
  );
}

function getColorScore(report) {
  return (
    report?.compatibility?.colorCoherence ?? report?.colorAnalysis?.colorScore
  );
}

function getSeasonScore(report) {
  return (
    report?.compatibility?.seasonalCoherence ?? report?.seasonality?.seasonScore
  );
}

export function getReportScoreRows(report, locale) {
  const scoreRows = [
    {
      key: "style",
      label: t("outfit.reportScoreStyleCoherence", undefined, locale),
      value: getStyleScore(report),
    },
    {
      key: "color",
      label: t("outfit.reportScoreColorHarmony", undefined, locale),
      value: getColorScore(report),
    },
    {
      key: "season",
      label: t("outfit.reportScoreSeasonFit", undefined, locale),
      value: getSeasonScore(report),
    },
    {
      key: "formality",
      label: t("outfit.reportScoreFormalityCoherence", undefined, locale),
      value: report?.compatibility?.formalityCoherence,
    },
    {
      key: "overall",
      label: t("outfit.reportScoreOverallCompatibility", undefined, locale),
      value: report?.compatibility?.overallScore,
    },
  ];

  return scoreRows
    .map((row) => ({ ...row, percent: toPercent(row.value) }))
    .filter((row) => row.percent !== null);
}

function getReportVerdictStatus(report) {
  const verdict = report?.verdict;
  return (
    getOutfitReportVerdictStatusForScore(
      verdict?.score,
      verdict?.llmStatus ?? verdict?.status,
    ) || String(verdict?.status || "").trim()
  );
}

export function getReportVerdictLabel(report, locale) {
  const status = getReportVerdictStatus(report);
  return status
    ? t(`outfit.reportVerdict.${status}`, undefined, locale)
    : t("outfit.reportVerdict.valid", undefined, locale);
}

export function collectReportText(value, target = []) {
  if (typeof value === "string") {
    target.push(value);
    return target;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectReportText(item, target));
    return target;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectReportText(item, target));
  }

  return target;
}
