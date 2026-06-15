import type {
  CapsuleReport,
  CapsuleReportIssue,
  CapsuleReportSuggestion,
} from "../../app/appTypes";
import {
  getCapsuleReportVerdictStatusForScore,
  getCapsuleReportVerdictToneForScore,
} from "../../../../shared/capsuleReportVerdict.js";
import {
  formatReportValue,
  toPercent,
  type OutfitReportTranslate,
} from "../outfitScreen/OutfitReportPanelUtils";

type Translate = OutfitReportTranslate;

export function getCapsuleReportScore(report: CapsuleReport) {
  return toPercent(report.verdict?.score);
}

export function getCapsuleReportTemperatureLabel(
  report: CapsuleReport,
  t: Translate,
) {
  const { max, min } = report.seasonality?.temperatureBandC || {};

  if (min != null && max != null) {
    return t("capsule.reportTemperatureRange", { max, min });
  }
  if (min != null) {
    return t("capsule.reportTemperatureFrom", { min });
  }
  if (max != null) {
    return t("capsule.reportTemperatureUpTo", { max });
  }
  return null;
}

function firstChipValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value));
}

export function getCapsuleReportChipValues(report: CapsuleReport) {
  const formality = firstChipValue(
    report.styleProfile?.formalityLevel,
    report.targetAlignment?.formalityFit?.detectedRange?.[0],
  );
  const style = firstChipValue(
    report.styleProfile?.primaryStyle,
    report.targetAlignment?.styleFit?.primaryDetectedStyle,
  );
  return [
    ...(report.seasonality?.primarySeasons || []),
    formality,
    style,
    report.colorAnalysis?.paletteType,
  ].filter((value): value is string => Boolean(value));
}

export function getCapsuleReportScoreRows(report: CapsuleReport, t: Translate) {
  return [
    {
      key: "target",
      label: t("capsule.reportScoreTargetFit"),
      value: report.targetAlignment?.overallScore,
    },
    {
      key: "coverage",
      label: t("capsule.reportScoreCategoryCoverage"),
      value: report.coverage?.overallScore,
    },
    {
      key: "versatility",
      label: t("capsule.reportScoreVersatility"),
      value: report.versatility?.overallScore,
    },
    {
      key: "cohesion",
      label: t("capsule.reportScoreCohesion"),
      value: report.cohesion?.overallScore,
    },
    {
      key: "season",
      label: t("capsule.reportScoreSeasonFit"),
      value: report.seasonality?.overallScore,
    },
    {
      key: "color",
      label: t("capsule.reportScoreColorHarmony"),
      value: report.colorAnalysis?.colorScore,
    },
  ]
    .map((row) => ({ ...row, percent: toPercent(row.value) }))
    .filter((row) => row.percent !== null);
}

export function getCapsuleReportVerdictLabel(
  report: CapsuleReport,
  t: Translate,
) {
  const status =
    getCapsuleReportVerdictStatusForScore(
      report.verdict?.score,
      report.verdict?.llmStatus ?? report.verdict?.status,
    ) || String(report.verdict?.status || "").trim();
  return status
    ? t(`capsule.reportVerdict.${status}`)
    : t("capsule.reportVerdict.good");
}

export function getCapsuleReportScoreTone(report: CapsuleReport) {
  return getCapsuleReportVerdictToneForScore(
    report.verdict?.score,
    report.verdict?.llmStatus ?? report.verdict?.status,
  );
}

function joinOverviewValues(values: unknown[]) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function buildCoverageOverview(report: CapsuleReport, t: Translate) {
  const coverage = report.coverage?.coreRoleCoverage;
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
  const weakCategories = report.coverage?.weakCategories || [];
  if (!strongRoles.length && !weakCategories.length) {
    return "";
  }
  if (strongRoles.length && weakCategories.length) {
    return t("capsule.reportOverviewCoverageWithWeak", {
      roles: strongRoles.join(", "),
      weak: weakCategories.map(formatReportValue).join(", "),
    });
  }
  if (strongRoles.length) {
    return t("capsule.reportOverviewCoverage", {
      roles: strongRoles.join(", "),
    });
  }
  return t("capsule.reportOverviewWeak", {
    weak: weakCategories.map(formatReportValue).join(", "),
  });
}

function buildGeneratedOutfitsOverview(report: CapsuleReport, t: Translate) {
  const assessment = report.generatedOutfitAssessment;
  if (!assessment) {
    return "";
  }
  const provided = Number(assessment.providedOutfitCount ?? 0);
  const complete = Number(assessment.completeOutfitCount ?? 0);
  const weak = Number(assessment.weakOutfitCount ?? 0);
  if (!provided && !complete && !weak) {
    return "";
  }
  return t("capsule.reportOverviewGeneratedOutfits", {
    complete,
    provided,
    weak,
  });
}

export function getCapsuleOverviewLines(report: CapsuleReport, t: Translate) {
  return [
    joinOverviewValues([
      typeof report.capsuleSummary?.itemCount === "number"
        ? t("capsule.reportOverviewItems", {
            count: report.capsuleSummary.itemCount,
          })
        : "",
      report.capsuleSummary?.capsuleType,
      report.capsuleSummary?.detectedCategoryBalance,
    ]),
    buildCoverageOverview(report, t),
    buildGeneratedOutfitsOverview(report, t),
  ].filter(Boolean);
}

export function getCapsuleReportStrengths(report: CapsuleReport) {
  return [
    ...(report.cohesion?.mainStrengths || []),
    report.versatility?.notes,
    report.coverage?.notes,
    report.colorAnalysis?.notes,
    report.seasonality?.notes,
  ].filter((value): value is string => Boolean(value));
}

export function getCapsuleReportIssueIds(issue: CapsuleReportIssue) {
  return (issue.affectedItemIds || []).filter(Boolean);
}

export function getCapsuleReportSuggestionIds(
  suggestion: CapsuleReportSuggestion,
) {
  return (suggestion.targetItemIds || []).filter(Boolean);
}

export type { Translate as CapsuleReportTranslate };
