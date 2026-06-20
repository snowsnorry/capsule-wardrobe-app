import { t } from "../../shared/i18n/helpers.js";
import {
  getPersonalItemsReportVerdictStatusForScore,
  getPersonalItemsReportVerdictToneForScore,
} from "../../shared/personalItemsReportVerdict.js";
import {
  collectReportText,
  formatReportValue,
  toPercent,
} from "./wardrobePdfOutfitReport.js";
import { hasNonLatinText } from "./wardrobePdfRuntime.js";

function joinOverviewValues(values) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function formatListValues(values) {
  return (values || []).map(formatReportValue).filter(Boolean).join(", ");
}

function getNestedValue(value, keys) {
  return keys.reduce((current, key) => current?.[key], value);
}

const PERSONAL_ITEMS_REPORT_SCORE_SPECS = [
  {
    key: "coverage",
    labelKey: "wardrobe.reportScoreCoverage",
    path: ["scores", "coverage"],
  },
  {
    key: "outfit-readiness",
    labelKey: "wardrobe.reportScoreOutfitReadiness",
    path: ["scores", "outfitReadiness"],
  },
  {
    key: "versatility",
    labelKey: "wardrobe.reportScoreVersatility",
    path: ["scores", "versatility"],
  },
  {
    key: "seasonality",
    labelKey: "wardrobe.reportScoreSeasonality",
    path: ["scores", "seasonality"],
  },
  {
    key: "style-clarity",
    labelKey: "wardrobe.reportScoreStyleClarity",
    path: ["scores", "styleClarity"],
  },
  {
    key: "color-harmony",
    labelKey: "wardrobe.reportScoreColorHarmony",
    path: ["scores", "colorHarmony"],
  },
  {
    key: "efficiency",
    labelKey: "wardrobe.reportScoreEfficiency",
    path: ["scores", "efficiency"],
  },
];

export function getPersonalItemsReportScore(report) {
  return toPercent(report?.verdict?.score);
}

export function getPersonalItemsReportTemperatureLabel(report, locale) {
  const { max, min } = report?.seasonality?.temperatureBandC || {};

  if (min != null && max != null) {
    return t("wardrobe.reportTemperatureRange", { max, min }, locale);
  }
  if (min != null) {
    return t("wardrobe.reportTemperatureFrom", { min }, locale);
  }
  if (max != null) {
    return t("wardrobe.reportTemperatureUpTo", { max }, locale);
  }
  return null;
}

export function getPersonalItemsReportChipValues(report) {
  return [
    ...(report?.personalItemsOverview?.dominantSeasons || []),
    ...(report?.personalItemsOverview?.dominantStyles || []).slice(0, 2),
    report?.colorAnalysis?.paletteType,
  ].filter(Boolean);
}

export function getPersonalItemsReportScoreRows(report, locale) {
  return PERSONAL_ITEMS_REPORT_SCORE_SPECS.map((row) => ({
    key: row.key,
    label: t(row.labelKey, undefined, locale),
    percent: toPercent(getNestedValue(report, row.path)),
  })).filter((row) => row.percent !== null);
}

function getPersonalItemsReportVerdictStatus(report) {
  const verdict = report?.verdict;
  return (
    getPersonalItemsReportVerdictStatusForScore(
      verdict?.score,
      verdict?.llmStatus ?? verdict?.status,
    ) || String(verdict?.status || "").trim()
  );
}

export function getPersonalItemsReportVerdictLabel(report, locale) {
  const status = getPersonalItemsReportVerdictStatus(report);
  return status
    ? t(`wardrobe.reportVerdict.${status}`, undefined, locale)
    : t("wardrobe.reportVerdict.good", undefined, locale);
}

export function getPersonalItemsReportScoreTone(report) {
  return getPersonalItemsReportVerdictToneForScore(
    report?.verdict?.score,
    report?.verdict?.llmStatus ?? report?.verdict?.status,
  );
}

export function getPersonalItemsReportOverviewLines(report, locale) {
  const overview = report?.personalItemsOverview || {};
  return [
    joinOverviewValues([
      typeof overview.itemCount === "number"
        ? t("wardrobe.reportItemCount", { count: overview.itemCount }, locale)
        : "",
      overview.personalItemsSize,
      overview.detectedCategoryBalance,
    ]),
    joinOverviewValues([
      overview.dominantStyles?.length
        ? `${t("wardrobe.reportDominantStyles", undefined, locale)}: ${formatListValues(
            overview.dominantStyles,
          )}`
        : "",
      overview.dominantSeasons?.length
        ? `${t("wardrobe.reportDominantSeasons", undefined, locale)}: ${formatListValues(
            overview.dominantSeasons,
          )}`
        : "",
    ]),
    joinOverviewValues([
      overview.dominantFormalityLevels?.length
        ? `${t("wardrobe.reportDominantFormalityLevels", undefined, locale)}: ${formatListValues(
            overview.dominantFormalityLevels,
          )}`
        : "",
      overview.summaryTags?.length
        ? `${t("wardrobe.reportSummaryTags", undefined, locale)}: ${formatListValues(
            overview.summaryTags,
          )}`
        : "",
    ]),
  ].filter(Boolean);
}

export function personalItemsReportNeedsUnicodeFallback(personalItems, locale) {
  if (locale === "ru") {
    return true;
  }

  return [
    t("wardrobe.reportTitle", undefined, locale),
    t("wardrobe.reportOutdated", undefined, locale),
    ...collectReportText(personalItems?.report),
  ].some(hasNonLatinText);
}
