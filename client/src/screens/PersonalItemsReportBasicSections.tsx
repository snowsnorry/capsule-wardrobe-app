import { Box, Stack, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import type { PersonalItemsReport } from "../app/appTypes";
import { ReportSection } from "./outfitScreen/OutfitReportPanelSectionPrimitives";
import { formatReportValue } from "./PersonalItemsReportPanelUtils";
import {
  hasText,
  Notes,
  optionalRow,
  percentLabel,
  reportListTextSx,
  type ReportContentProps,
  ScoreRows,
  SeverityListItem,
  severityToTone,
  ValueRows,
} from "./PersonalItemsReportSectionPrimitives";
import { getPersonalItemsReportScoreRows } from "./PersonalItemsReportPanelUtils";

function ScoresSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const rows = getPersonalItemsReportScoreRows(report, t);
  if (!rows.length) return null;

  return (
    <ReportSection title={t("wardrobe.reportScores")}>
      <ScoreRows rows={rows} />
    </ReportSection>
  );
}

function OverviewSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const overview = report.personalItemsOverview;
  if (!overview) return null;

  const rows = [
    optionalRow(
      "balance",
      t("wardrobe.reportDetectedCategoryBalance"),
      overview.detectedCategoryBalance,
    ),
    optionalRow(
      "styles",
      t("wardrobe.reportDominantStyles"),
      overview.dominantStyles,
    ),
    optionalRow(
      "seasons",
      t("wardrobe.reportDominantSeasons"),
      overview.dominantSeasons,
    ),
    optionalRow(
      "formality",
      t("wardrobe.reportDominantFormalityLevels"),
      overview.dominantFormalityLevels,
    ),
    optionalRow("tags", t("wardrobe.reportSummaryTags"), overview.summaryTags),
  ];
  if (!rows.some(Boolean)) return null;

  return (
    <ReportSection
      title={t("wardrobe.reportOverview")}
      icon={<InfoOutlinedIcon color="primary" fontSize="small" />}
    >
      <ValueRows rows={rows} />
    </ReportSection>
  );
}

function CoverageSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const coverage = report.coverage;
  if (!coverage) return null;

  const core = coverage.coreRoleCoverage || {};
  const bottlenecks = coverage.bottlenecks || [];
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(coverage.overallScore),
    ),
    optionalRow("tops", t("wardrobe.reportRoleTops"), core.tops),
    optionalRow("bottoms", t("wardrobe.reportRoleBottoms"), core.bottoms),
    optionalRow("shoes", t("wardrobe.reportRoleShoes"), core.shoes),
    optionalRow("layers", t("wardrobe.reportRoleLayers"), core.layers),
    optionalRow("dresses", t("wardrobe.reportRoleDresses"), core.dresses),
    optionalRow(
      "accessories",
      t("wardrobe.reportRoleAccessories"),
      core.accessories,
    ),
    optionalRow(
      "missing",
      t("wardrobe.reportMissingCategories"),
      coverage.missingCategories,
    ),
    optionalRow(
      "weak",
      t("wardrobe.reportWeakCategories"),
      coverage.weakCategories,
    ),
    optionalRow(
      "overrepresented",
      t("wardrobe.reportOverrepresentedCategories"),
      coverage.overrepresentedCategories,
    ),
  ];
  if (!rows.some(Boolean) && !bottlenecks.length && !hasText(coverage.notes)) {
    return null;
  }

  return (
    <ReportSection
      title={t("wardrobe.reportCoverage")}
      icon={<TuneOutlinedIcon color="primary" fontSize="small" />}
    >
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <Bottlenecks rows={bottlenecks} />
        <Notes value={coverage.notes} />
      </Stack>
    </ReportSection>
  );
}

function Bottlenecks({
  rows,
}: {
  rows: NonNullable<PersonalItemsReport["coverage"]>["bottlenecks"];
}) {
  const items = (rows || []).filter((row) => hasText(row.message));
  if (!items.length) return null;

  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
      {items.map((row, index) => (
        <SeverityListItem
          key={`${row.category || "bottleneck"}-${index}`}
          tone={severityToTone(row.severity)}
        >
          <Typography variant="body2" sx={reportListTextSx}>
            {row.category ? (
              <Box component="span" sx={{ fontWeight: 750 }}>
                {formatReportValue(row.category)}:{" "}
              </Box>
            ) : null}
            {row.message}
          </Typography>
        </SeverityListItem>
      ))}
    </Stack>
  );
}

function OutfitReadinessSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const readiness = report.outfitReadiness;
  if (!readiness) return null;

  const range = readiness.estimatedOutfitRange;
  const rangeLabel =
    range?.min != null || range?.max != null
      ? t("wardrobe.reportEstimatedOutfitRangeValue", {
          confidence: formatReportValue(range.confidence),
          max: range.max ?? "-",
          min: range.min ?? "-",
        })
      : "";
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(readiness.overallScore),
    ),
    optionalRow(
      "formulas",
      t("wardrobe.reportSupportedFormulaTypes"),
      readiness.supportedFormulaTypes,
    ),
    optionalRow("range", t("wardrobe.reportEstimatedOutfitRange"), rangeLabel),
    optionalRow(
      "blockers",
      t("wardrobe.reportMainBlockers"),
      readiness.mainBlockers,
    ),
  ];
  if (!rows.some(Boolean) && !hasText(readiness.notes)) return null;

  return (
    <ReportSection title={t("wardrobe.reportOutfitReadiness")}>
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <Notes value={readiness.notes} />
      </Stack>
    </ReportSection>
  );
}

function VersatilitySection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const versatility = report.versatility;
  if (!versatility) return null;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(versatility.overallScore),
    ),
    optionalRow(
      "mix",
      t("wardrobe.reportMixAndMatchScore"),
      percentLabel(versatility.mixAndMatchScore),
    ),
    optionalRow(
      "repeatability",
      t("wardrobe.reportRepeatabilityScore"),
      percentLabel(versatility.repeatabilityScore),
    ),
    optionalRow(
      "variety",
      t("wardrobe.reportOutfitVariety"),
      versatility.outfitVariety,
    ),
    optionalRow(
      "modes",
      t("wardrobe.reportPrimaryUseModes"),
      versatility.primaryUseModes,
    ),
    optionalRow(
      "limits",
      t("wardrobe.reportLimitingFactors"),
      versatility.limitingFactors,
    ),
  ];
  if (!rows.some(Boolean) && !hasText(versatility.notes)) return null;

  return (
    <ReportSection title={t("wardrobe.reportVersatility")}>
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <Notes value={versatility.notes} />
      </Stack>
    </ReportSection>
  );
}

export {
  CoverageSection,
  OutfitReadinessSection,
  OverviewSection,
  ScoresSection,
  VersatilitySection,
};
