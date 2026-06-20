import type {
  PersonalItemsReportIssue,
  PersonalItemsReportStrength,
  PersonalItemsReportSuggestion,
} from "../app/personalItemsReportTypes";
import type { PersonalItemsReport, WardrobeItem } from "../app/appTypes";
import {
  getPersonalItemsReportVerdictStatusForScore,
  getPersonalItemsReportVerdictToneForScore,
} from "../../../shared/personalItemsReportVerdict.js";
import {
  formatReportValue,
  toPercent,
  type OutfitReportTranslate,
} from "./outfitScreen/OutfitReportPanelUtils";

type Translate = OutfitReportTranslate;

type ItemReference = {
  id: string;
  label: string;
};

type ItemReferenceResolver = (
  ids: string[] | null | undefined,
) => ItemReference[];

function getTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function getDisplayItemKey(item: WardrobeItem) {
  return getTrimmedString(item?.id || item?.wardrobeId);
}

function getItemDisplayName(item: WardrobeItem, t: Translate) {
  const name = getTrimmedString(item?.name);
  if (name) return name;

  const brand = getTrimmedString(item?.brand);
  const category = getTrimmedString(item?.category);
  if (brand && category) {
    return `${brand} ${formatReportValue(category)}`;
  }
  if (brand) return brand;
  if (category) return formatReportValue(category);

  return t("wardrobe.reportUnnamedItem", {
    id: getTrimmedString(item?.id) || "-",
  });
}

function addLookupId(map: Map<string, string>, id: unknown, label: string) {
  const normalized = getTrimmedString(id);
  if (normalized && !map.has(normalized)) {
    map.set(normalized, label);
  }
}

function createPersonalItemsReportItemResolver(
  items: WardrobeItem[],
  t: Translate,
): ItemReferenceResolver {
  const namesById = new Map<string, string>();
  items.forEach((item) => {
    const label = getItemDisplayName(item, t);
    addLookupId(namesById, item?.id, label);
    addLookupId(namesById, item?.wardrobeId, label);
  });

  return (ids) =>
    (ids || [])
      .map((id) => getTrimmedString(id))
      .filter(Boolean)
      .map((id) => ({
        id,
        label:
          namesById.get(id) ||
          t("wardrobe.reportUnnamedItem", {
            id,
          }),
      }));
}

function getHighlightedPersonalItemsReportItemKeys(
  items: WardrobeItem[],
  reportItemIds: string[],
) {
  const targetIds = new Set(
    reportItemIds.map((id) => getTrimmedString(id)).filter(Boolean),
  );
  if (!targetIds.size) return [];

  return items
    .filter((item) =>
      [item?.id, item?.wardrobeId].some((id) =>
        targetIds.has(getTrimmedString(id)),
      ),
    )
    .map(getDisplayItemKey)
    .filter(Boolean);
}

function getPersonalItemsReportScore(report: PersonalItemsReport) {
  return toPercent(report.verdict?.score);
}

function getPersonalItemsReportVerdictLabel(
  report: PersonalItemsReport,
  t: Translate,
) {
  const status =
    getPersonalItemsReportVerdictStatusForScore(
      report.verdict?.score,
      report.verdict?.llmStatus ?? report.verdict?.status,
    ) || getTrimmedString(report.verdict?.status);
  return status
    ? t(`wardrobe.reportVerdict.${status}`)
    : t("wardrobe.reportVerdict.good");
}

function getPersonalItemsReportScoreTone(report: PersonalItemsReport) {
  return getPersonalItemsReportVerdictToneForScore(
    report.verdict?.score,
    report.verdict?.llmStatus ?? report.verdict?.status,
  );
}

function getPersonalItemsReportTemperatureLabel(
  report: PersonalItemsReport,
  t: Translate,
) {
  const { max, min } = report.seasonality?.temperatureBandC || {};
  if (min != null && max != null) {
    return t("wardrobe.reportTemperatureRange", { max, min });
  }
  if (min != null) {
    return t("wardrobe.reportTemperatureFrom", { min });
  }
  if (max != null) {
    return t("wardrobe.reportTemperatureUpTo", { max });
  }
  return null;
}

function getPersonalItemsReportChipValues(report: PersonalItemsReport) {
  return [
    ...(report.personalItemsOverview?.dominantSeasons || []),
    ...(report.personalItemsOverview?.dominantStyles || []).slice(0, 2),
    report.colorAnalysis?.paletteType,
  ].filter((value): value is string => Boolean(value));
}

function getPersonalItemsReportScoreRows(
  report: PersonalItemsReport,
  t: Translate,
) {
  return [
    {
      key: "coverage",
      label: t("wardrobe.reportScoreCoverage"),
      value: report.scores?.coverage,
    },
    {
      key: "outfit-readiness",
      label: t("wardrobe.reportScoreOutfitReadiness"),
      value: report.scores?.outfitReadiness,
    },
    {
      key: "versatility",
      label: t("wardrobe.reportScoreVersatility"),
      value: report.scores?.versatility,
    },
    {
      key: "seasonality",
      label: t("wardrobe.reportScoreSeasonality"),
      value: report.scores?.seasonality,
    },
    {
      key: "style-clarity",
      label: t("wardrobe.reportScoreStyleClarity"),
      value: report.scores?.styleClarity,
    },
    {
      key: "color-harmony",
      label: t("wardrobe.reportScoreColorHarmony"),
      value: report.scores?.colorHarmony,
    },
    {
      key: "efficiency",
      label: t("wardrobe.reportScoreEfficiency"),
      value: report.scores?.efficiency,
    },
  ]
    .map((row) => ({ ...row, percent: toPercent(row.value) }))
    .filter((row) => row.percent !== null);
}

function getPersonalItemsReportStrengthIds(
  strength: PersonalItemsReportStrength,
) {
  return (strength.supportingItemIds || []).filter(Boolean);
}

function getPersonalItemsReportIssueIds(issue: PersonalItemsReportIssue) {
  return (issue.affectedItemIds || []).filter(Boolean);
}

function getPersonalItemsReportSuggestionIds(
  suggestion: PersonalItemsReportSuggestion,
) {
  return (suggestion.targetItemIds || []).filter(Boolean);
}

function joinItemReferenceLabels(references: ItemReference[]) {
  return references.map((reference) => reference.label).join(", ");
}

export {
  createPersonalItemsReportItemResolver,
  formatReportValue,
  getHighlightedPersonalItemsReportItemKeys,
  getPersonalItemsReportChipValues,
  getPersonalItemsReportIssueIds,
  getPersonalItemsReportScore,
  getPersonalItemsReportScoreRows,
  getPersonalItemsReportScoreTone,
  getPersonalItemsReportStrengthIds,
  getPersonalItemsReportSuggestionIds,
  getPersonalItemsReportTemperatureLabel,
  getPersonalItemsReportVerdictLabel,
  joinItemReferenceLabels,
  toPercent,
  type ItemReferenceResolver,
  type Translate as PersonalItemsReportTranslate,
};
