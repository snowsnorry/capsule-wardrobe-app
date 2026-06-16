import { t } from "../../shared/i18n/helpers.js";
import {
  getCapsuleReportVerdictStatusForScore,
  getCapsuleReportVerdictToneForScore,
} from "../../shared/capsuleReportVerdict.js";
import {
  collectReportText,
  formatReportValue,
  toPercent,
} from "./wardrobePdfOutfitReport.js";
import { hasNonLatinText } from "./wardrobePdfRuntime.js";

function firstChipValue(...values) {
  return values.find((value) => Boolean(value));
}

function getNestedValue(value, keys) {
  return keys.reduce((current, key) => current?.[key], value);
}

function joinOverviewValues(values) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function getCapsuleReportScore(report) {
  return toPercent(report?.verdict?.score);
}

export function getCapsuleReportTemperatureLabel(report, locale) {
  const { max, min } = report?.seasonality?.temperatureBandC || {};

  if (min != null && max != null) {
    return t("capsule.reportTemperatureRange", { max, min }, locale);
  }
  if (min != null) {
    return t("capsule.reportTemperatureFrom", { min }, locale);
  }
  if (max != null) {
    return t("capsule.reportTemperatureUpTo", { max }, locale);
  }
  return null;
}

export function getCapsuleReportChipValues(report) {
  const formality = firstChipValue(
    getNestedValue(report, ["styleProfile", "formalityLevel"]),
    getNestedValue(report, [
      "targetAlignment",
      "formalityFit",
      "detectedRange",
    ])?.[0],
  );
  const style = firstChipValue(
    getNestedValue(report, ["styleProfile", "primaryStyle"]),
    getNestedValue(report, [
      "targetAlignment",
      "styleFit",
      "primaryDetectedStyle",
    ]),
  );
  return [
    ...(getNestedValue(report, ["seasonality", "primarySeasons"]) || []),
    formality,
    style,
    getNestedValue(report, ["colorAnalysis", "paletteType"]),
  ].filter(Boolean);
}

export function getCapsuleReportScoreRows(report, locale) {
  const scoreSpecs = [
    {
      key: "target",
      label: t("capsule.reportScoreTargetFit", undefined, locale),
      path: ["targetAlignment", "overallScore"],
    },
    {
      key: "coverage",
      label: t("capsule.reportScoreCategoryCoverage", undefined, locale),
      path: ["coverage", "overallScore"],
    },
    {
      key: "versatility",
      label: t("capsule.reportScoreVersatility", undefined, locale),
      path: ["versatility", "overallScore"],
    },
    {
      key: "cohesion",
      label: t("capsule.reportScoreCohesion", undefined, locale),
      path: ["cohesion", "overallScore"],
    },
    {
      key: "season",
      label: t("capsule.reportScoreSeasonFit", undefined, locale),
      path: ["seasonality", "overallScore"],
    },
    {
      key: "color",
      label: t("capsule.reportScoreColorHarmony", undefined, locale),
      path: ["colorAnalysis", "colorScore"],
    },
  ];

  return scoreSpecs
    .map((row) => ({
      key: row.key,
      label: row.label,
      percent: toPercent(getNestedValue(report, row.path)),
    }))
    .filter((row) => row.percent !== null);
}

function getCapsuleReportVerdictStatus(report) {
  const verdict = report?.verdict;
  return (
    getCapsuleReportVerdictStatusForScore(
      verdict?.score,
      verdict?.llmStatus ?? verdict?.status,
    ) || String(verdict?.status || "").trim()
  );
}

export function getCapsuleReportVerdictLabel(report, locale) {
  const status = getCapsuleReportVerdictStatus(report);
  return status
    ? t(`capsule.reportVerdict.${status}`, undefined, locale)
    : t("capsule.reportVerdict.good", undefined, locale);
}

export function getCapsuleReportScoreTone(report) {
  return getCapsuleReportVerdictToneForScore(
    report?.verdict?.score,
    report?.verdict?.llmStatus ?? report?.verdict?.status,
  );
}

function buildCoverageOverview(report, locale) {
  const coverage = report?.coverage?.coreRoleCoverage;
  const strongRoles = coverage
    ? Object.entries(coverage)
        .filter(([, value]) => {
          const normalized = String(value || "")
            .trim()
            .toLowerCase();
          return (
            normalized &&
            !/(weak|missing|limited|limiting|gap|none)/i.test(normalized)
          );
        })
        .map(([key]) => formatReportValue(key))
    : [];
  const weakCategories = report?.coverage?.weakCategories || [];
  if (!strongRoles.length && !weakCategories.length) {
    return "";
  }
  if (strongRoles.length && weakCategories.length) {
    return t(
      "capsule.reportOverviewCoverageWithWeak",
      {
        roles: strongRoles.join(", "),
        weak: weakCategories.map(formatReportValue).join(", "),
      },
      locale,
    );
  }
  if (strongRoles.length) {
    return t(
      "capsule.reportOverviewCoverage",
      {
        roles: strongRoles.join(", "),
      },
      locale,
    );
  }
  return t(
    "capsule.reportOverviewWeak",
    {
      weak: weakCategories.map(formatReportValue).join(", "),
    },
    locale,
  );
}

export function getCapsuleGeneratedOutfitsOverview(report, locale) {
  const assessment = report?.generatedOutfitAssessment;
  if (!assessment) {
    return "";
  }
  const provided = Number(assessment.providedOutfitCount ?? 0);
  const complete = Number(assessment.completeOutfitCount ?? 0);
  const weak = Number(assessment.weakOutfitCount ?? 0);
  if (!provided && !complete && !weak) {
    return "";
  }
  return t(
    "capsule.reportOverviewGeneratedOutfits",
    {
      complete,
      provided,
      weak,
    },
    locale,
  );
}

function getOutfitSetNumber(outfitId, index) {
  const match = String(outfitId || "")
    .trim()
    .match(/^outfit-set-(\d+)$/);
  return match ? Number(match[1]) : index + 1;
}

export function getCapsuleWeakOutfitOverviewRows(report, locale) {
  return (report?.generatedOutfitAssessment?.weakOutfits || [])
    .map((outfit, index) => {
      const issue = String(outfit?.issue || "").trim();
      const suggestion = String(outfit?.suggestion || "").trim();
      if (!issue && !suggestion) {
        return null;
      }
      const number = getOutfitSetNumber(outfit?.outfitId, index);
      return {
        key: `${outfit?.outfitId || "weak-outfit"}-${index}`,
        outfitLabel: t("capsule.outfitSet", { number }, locale),
        issue,
        suggestion,
      };
    })
    .filter(Boolean);
}

export function getCapsuleOverviewLines(report, locale) {
  return [
    joinOverviewValues([
      typeof report?.capsuleSummary?.itemCount === "number"
        ? t(
            "capsule.reportOverviewItems",
            {
              count: report.capsuleSummary.itemCount,
            },
            locale,
          )
        : "",
      report?.capsuleSummary?.capsuleType,
      report?.capsuleSummary?.detectedCategoryBalance,
    ]),
    buildCoverageOverview(report, locale),
    getCapsuleGeneratedOutfitsOverview(report, locale),
  ].filter(Boolean);
}

export function getCapsuleReportStrengths(report) {
  return [
    ...(report?.cohesion?.mainStrengths || []),
    report?.versatility?.notes,
    report?.coverage?.notes,
    report?.colorAnalysis?.notes,
    report?.seasonality?.notes,
  ].filter(Boolean);
}

export function capsuleReportNeedsUnicodeFallback(capsule, locale) {
  if (locale === "ru") {
    return true;
  }

  return [
    capsule?.title,
    t("capsule.reportTitle", undefined, locale),
    t("capsule.reportOutdated", undefined, locale),
    ...collectReportText(capsule?.report),
  ].some(hasNonLatinText);
}
