import { Box, Stack, Typography } from "@mui/material";
import type { PersonalItemsReport } from "../app/appTypes";
import {
  HighlightRow,
  ReportSection,
} from "./outfitScreen/OutfitReportPanelSectionPrimitives";
import { formatReportValue } from "./PersonalItemsReportPanelUtils";
import {
  DetailRows,
  hasText,
  Notes,
  optionalRow,
  percentLabel,
  ReferenceRows,
  RelatedItems,
  reportListTextSx,
  type ReportContentProps,
  ValueRows,
} from "./PersonalItemsReportSectionPrimitives";

function StyleProfileSection({
  onHighlightItemIds,
  report,
  resolveItems,
  t,
}: ReportContentProps) {
  const profile = report.styleProfile;
  if (!profile) return null;

  const clusters = profile.styleClusters || [];
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(profile.overallScore),
    ),
    optionalRow(
      "primary",
      t("wardrobe.reportPrimaryStyles"),
      profile.primaryStyles,
    ),
    optionalRow(
      "fragmentation",
      t("wardrobe.reportFragmentation"),
      profile.fragmentation,
    ),
  ];
  if (!rows.some(Boolean) && !clusters.length && !hasText(profile.notes)) {
    return null;
  }

  return (
    <ReportSection title={t("wardrobe.reportStyleProfile")}>
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <StyleClusters
          clusters={clusters}
          onHighlightItemIds={onHighlightItemIds}
          resolveItems={resolveItems}
          t={t}
        />
        <Notes value={profile.notes} />
      </Stack>
    </ReportSection>
  );
}

function StyleClusters({
  clusters,
  onHighlightItemIds,
  resolveItems,
  t,
}: Pick<ReportContentProps, "onHighlightItemIds" | "resolveItems" | "t"> & {
  clusters: NonNullable<
    NonNullable<PersonalItemsReport["styleProfile"]>["styleClusters"]
  >;
}) {
  if (!clusters.length) return null;

  return (
    <Stack spacing={0.75}>
      {clusters.map((cluster, index) => {
        const ids = cluster.representativeItemIds || [];
        return (
          <HighlightRow
            key={`${cluster.label || cluster.style || "cluster"}-${index}`}
            ids={ids}
            onHighlightItemIds={onHighlightItemIds}
          >
            <Stack spacing={0.35}>
              <Typography variant="body2" sx={reportListTextSx}>
                <Box component="span" sx={{ fontWeight: 750 }}>
                  {cluster.label || t("wardrobe.reportStyleCluster")}
                </Box>
                {cluster.style ? `, ${formatReportValue(cluster.style)}` : ""}
                {cluster.itemCount != null
                  ? `, ${t("wardrobe.reportItemCount", {
                      count: cluster.itemCount,
                    })}`
                  : ""}
              </Typography>
              <Notes value={cluster.notes} />
              <RelatedItems ids={ids} resolveItems={resolveItems} t={t} />
            </Stack>
          </HighlightRow>
        );
      })}
    </Stack>
  );
}

function SeasonalitySection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const seasonality = report.seasonality;
  if (!seasonality) return null;
  const coverage = seasonality.seasonCoverage || {};
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(seasonality.overallScore),
    ),
    optionalRow("spring", t("wardrobe.reportSeasonSpring"), coverage.spring),
    optionalRow("summer", t("wardrobe.reportSeasonSummer"), coverage.summer),
    optionalRow("autumn", t("wardrobe.reportSeasonAutumn"), coverage.autumn),
    optionalRow("winter", t("wardrobe.reportSeasonWinter"), coverage.winter),
    optionalRow(
      "primary",
      t("wardrobe.reportPrimarySeasons"),
      seasonality.primarySeasons,
    ),
    optionalRow(
      "weak",
      t("wardrobe.reportWeakSeasons"),
      seasonality.weakSeasons,
    ),
    optionalRow(
      "temperature",
      t("wardrobe.reportTemperatureBand"),
      getTemperatureBandLabel(seasonality.temperatureBandC, t),
    ),
    optionalRow(
      "layering",
      t("wardrobe.reportLayeringSupport"),
      seasonality.layeringSupport,
    ),
    optionalRow(
      "suitability",
      t("wardrobe.reportWeatherSuitability"),
      seasonality.weatherSuitability,
    ),
  ];
  const detailRows = [
    optionalRow(
      "limitations",
      t("wardrobe.reportWeatherLimitations"),
      seasonality.weatherLimitations,
    ),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !hasText(seasonality.notes)
  ) {
    return null;
  }

  return (
    <ReportSection title={t("wardrobe.reportSeasonality")}>
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <DetailRows rows={detailRows} />
        <Notes value={seasonality.notes} />
      </Stack>
    </ReportSection>
  );
}

function getTemperatureBandLabel(
  band: NonNullable<PersonalItemsReport["seasonality"]>["temperatureBandC"],
  t: ReportContentProps["t"],
) {
  if (!band) return "";
  const { max, min } = band;
  if (min != null && max != null) {
    return t("wardrobe.reportTemperatureRange", { max, min });
  }
  if (min != null) return t("wardrobe.reportTemperatureFrom", { min });
  if (max != null) return t("wardrobe.reportTemperatureUpTo", { max });
  return "";
}

function ColorAnalysisSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const color = report.colorAnalysis;
  if (!color) return null;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(color.overallScore),
    ),
    optionalRow("palette", t("wardrobe.reportPaletteType"), color.paletteType),
    optionalRow("base", t("wardrobe.reportBaseColors"), color.baseColors),
    optionalRow("accent", t("wardrobe.reportAccentColors"), color.accentColors),
    optionalRow(
      "contrast",
      t("wardrobe.reportContrastLevel"),
      color.contrastLevel,
    ),
    optionalRow("harmony", t("wardrobe.reportHarmony"), color.harmony),
  ];
  const detailRows = [
    optionalRow("gaps", t("wardrobe.reportColorGaps"), color.colorGaps),
    optionalRow("risks", t("wardrobe.reportColorRisks"), color.colorRisks),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !hasText(color.notes)
  ) {
    return null;
  }

  return (
    <ReportSection title={t("wardrobe.reportColorAnalysis")}>
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <DetailRows rows={detailRows} />
        <Notes value={color.notes} />
      </Stack>
    </ReportSection>
  );
}

function EfficiencySection({
  onHighlightItemIds,
  report,
  resolveItems,
  t,
}: ReportContentProps) {
  const efficiency = report.efficiency;
  if (!efficiency) return null;

  const redundancies = efficiency.notableRedundancies || [];
  const orphans = efficiency.potentialOrphans || [];
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore"),
      percentLabel(efficiency.overallScore),
    ),
    optionalRow(
      "redundancy",
      t("wardrobe.reportRedundancyLevel"),
      efficiency.redundancyLevel,
    ),
    optionalRow(
      "orphan",
      t("wardrobe.reportOrphanItemRisk"),
      efficiency.orphanItemRisk,
    ),
  ];
  const detailRows = [
    optionalRow(
      "strengths",
      t("wardrobe.reportUnderusedStrengths"),
      efficiency.underusedStrengths,
    ),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !redundancies.length &&
    !orphans.length &&
    !hasText(efficiency.notes)
  ) {
    return null;
  }

  return (
    <ReportSection title={t("wardrobe.reportEfficiency")}>
      <Stack spacing={1.25}>
        <ValueRows rows={rows} />
        <DetailRows rows={detailRows} />
        <ReferenceRows
          rows={redundancies.map((row, index) => ({
            ids: row.itemIds || [],
            key: `${row.category || "redundancy"}-${index}`,
            message: row.message || "",
            prefix: row.category ? formatReportValue(row.category) : "",
          }))}
          onHighlightItemIds={onHighlightItemIds}
          resolveItems={resolveItems}
          t={t}
          title={t("wardrobe.reportNotableRedundancies")}
          tone="warning"
        />
        <ReferenceRows
          rows={orphans.map((row, index) => ({
            ids: row.itemIds || [],
            key: `orphan-${index}`,
            message: row.reason || "",
          }))}
          onHighlightItemIds={onHighlightItemIds}
          resolveItems={resolveItems}
          t={t}
          title={t("wardrobe.reportPotentialOrphans")}
          tone="warning"
        />
        <Notes value={efficiency.notes} />
      </Stack>
    </ReportSection>
  );
}

export {
  ColorAnalysisSection,
  EfficiencySection,
  SeasonalitySection,
  StyleProfileSection,
};
