import { t } from "../../shared/i18n/helpers.js";
import { formatReportValue } from "./wardrobePdfOutfitReport.js";
import {
  addBulletBottomGap,
  cleanString,
  drawDetailRows,
  drawNotes,
  drawBulletMarker,
  drawPrefixedText,
  drawRelatedItemsRow,
  drawReportSectionTitle,
  drawSubsectionTitle,
  drawValueRows,
  hasText,
  measurePrefixedTextHeight,
  measureRelatedItemsHeight,
  optionalRow,
  percentLabel,
  REPORT_BODY_WIDTH,
  resolveRelatedItemLabels,
  SUBSECTION_GAP,
} from "./wardrobePdfPersonalItemsReportPrimitives.js";
import { ensureReportBlockSpace } from "./wardrobePdfOutfitDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
  REPORT_CONTENT_X,
} from "./wardrobePdfOutfitConstants.js";

const BULLET_X = REPORT_CONTENT_X + 5;

export function drawStyleProfileSection(
  pdfDoc,
  state,
  { fonts, locale, report, resolveItems },
) {
  const profile = report?.styleProfile;
  if (!profile) return state;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(profile.overallScore),
    ),
    optionalRow(
      "primary",
      t("wardrobe.reportPrimaryStyles", undefined, locale),
      profile.primaryStyles,
    ),
    optionalRow(
      "fragmentation",
      t("wardrobe.reportFragmentation", undefined, locale),
      profile.fragmentation,
    ),
  ];
  const clusters = profile.styleClusters || [];
  if (!rows.some(Boolean) && !clusters.length && !hasText(profile.notes)) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportStyleProfile", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawStyleClusters(pdfDoc, state, {
    clusters,
    fonts,
    locale,
    resolveItems,
    title: t("wardrobe.reportStyleCluster", undefined, locale),
  });
  state = drawNotes(pdfDoc, state, { fonts, value: profile.notes });
  state.cursorY -= 12;
  return state;
}

function drawStyleClusters(
  pdfDoc,
  state,
  { clusters, fonts, locale, resolveItems, title },
) {
  if (!clusters.length) return state;
  state = drawSubsectionTitle(pdfDoc, state, { fonts, title });
  for (const cluster of clusters) {
    state = drawStyleCluster(pdfDoc, state, {
      cluster,
      fonts,
      locale,
      resolveItems,
    });
  }
  state.cursorY -= SUBSECTION_GAP;
  return state;
}

function drawStyleCluster(
  pdfDoc,
  state,
  { cluster, fonts, locale, resolveItems },
) {
  const label =
    cleanString(cluster?.label) ||
    t("wardrobe.reportStyleCluster", undefined, locale);
  const text = getStyleClusterText(cluster, locale);
  const relatedLabels = resolveRelatedItemLabels(
    cluster?.representativeItemIds,
    resolveItems,
  );
  state = ensureReportBlockSpace(
    pdfDoc,
    state,
    measurePrefixedTextHeight({
      fonts,
      prefix: label,
      text,
      width: REPORT_BODY_WIDTH,
    }) +
      measurePrefixedTextHeight({
        fonts,
        text: cluster?.notes,
        width: REPORT_BODY_WIDTH,
      }) +
      measureRelatedItemsHeight({
        fonts,
        labels: relatedLabels,
        locale,
        width: REPORT_BODY_WIDTH,
      }) +
      4,
  );
  state = drawPrefixedText(pdfDoc, state, {
    fonts,
    prefix: label,
    text,
    width: BULLET_BODY_WIDTH,
    x: BULLET_BODY_X,
  });
  state = drawPrefixedText(pdfDoc, state, {
    fonts,
    text: cluster?.notes,
    width: BULLET_BODY_WIDTH,
    x: BULLET_BODY_X,
  });
  return drawRelatedItemsRow(pdfDoc, state, {
    fonts,
    labels: relatedLabels,
    locale,
  });
}

function getStyleClusterText(cluster, locale) {
  const style = cleanString(cluster?.style);
  const count =
    cluster?.itemCount != null
      ? t("wardrobe.reportItemCount", { count: cluster.itemCount }, locale)
      : "";
  return [style ? formatReportValue(style) : "", count]
    .filter(Boolean)
    .join(", ");
}

function getTemperatureBandLabel(band, locale) {
  if (!band) return "";
  const { max, min } = band;
  if (min != null && max != null) {
    return t("wardrobe.reportTemperatureRange", { max, min }, locale);
  }
  if (min != null) return t("wardrobe.reportTemperatureFrom", { min }, locale);
  if (max != null) return t("wardrobe.reportTemperatureUpTo", { max }, locale);
  return "";
}

export function drawSeasonalitySection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
  const seasonality = report?.seasonality;
  if (!seasonality) return state;

  const coverage = seasonality.seasonCoverage || {};
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(seasonality.overallScore),
    ),
    optionalRow(
      "spring",
      t("wardrobe.reportSeasonSpring", undefined, locale),
      coverage.spring,
    ),
    optionalRow(
      "summer",
      t("wardrobe.reportSeasonSummer", undefined, locale),
      coverage.summer,
    ),
    optionalRow(
      "autumn",
      t("wardrobe.reportSeasonAutumn", undefined, locale),
      coverage.autumn,
    ),
    optionalRow(
      "winter",
      t("wardrobe.reportSeasonWinter", undefined, locale),
      coverage.winter,
    ),
    optionalRow(
      "primary",
      t("wardrobe.reportPrimarySeasons", undefined, locale),
      seasonality.primarySeasons,
    ),
    optionalRow(
      "weak",
      t("wardrobe.reportWeakSeasons", undefined, locale),
      seasonality.weakSeasons,
    ),
    optionalRow(
      "temperature",
      t("wardrobe.reportTemperatureBand", undefined, locale),
      getTemperatureBandLabel(seasonality.temperatureBandC, locale),
    ),
    optionalRow(
      "layering",
      t("wardrobe.reportLayeringSupport", undefined, locale),
      seasonality.layeringSupport,
    ),
    optionalRow(
      "suitability",
      t("wardrobe.reportWeatherSuitability", undefined, locale),
      seasonality.weatherSuitability,
    ),
  ];
  const detailRows = [
    optionalRow(
      "limitations",
      t("wardrobe.reportWeatherLimitations", undefined, locale),
      seasonality.weatherLimitations,
    ),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !hasText(seasonality.notes)
  ) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportSeasonality", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawDetailRows(pdfDoc, state, { fonts, rows: detailRows });
  state = drawNotes(pdfDoc, state, { fonts, value: seasonality.notes });
  state.cursorY -= 12;
  return state;
}

export function drawColorAnalysisSection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
  const color = report?.colorAnalysis;
  if (!color) return state;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(color.overallScore),
    ),
    optionalRow(
      "palette",
      t("wardrobe.reportPaletteType", undefined, locale),
      color.paletteType,
    ),
    optionalRow(
      "base",
      t("wardrobe.reportBaseColors", undefined, locale),
      color.baseColors,
    ),
    optionalRow(
      "accent",
      t("wardrobe.reportAccentColors", undefined, locale),
      color.accentColors,
    ),
    optionalRow(
      "contrast",
      t("wardrobe.reportContrastLevel", undefined, locale),
      color.contrastLevel,
    ),
    optionalRow(
      "harmony",
      t("wardrobe.reportHarmony", undefined, locale),
      color.harmony,
    ),
  ];
  const detailRows = [
    optionalRow(
      "gaps",
      t("wardrobe.reportColorGaps", undefined, locale),
      color.colorGaps,
    ),
    optionalRow(
      "risks",
      t("wardrobe.reportColorRisks", undefined, locale),
      color.colorRisks,
    ),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !hasText(color.notes)
  ) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportColorAnalysis", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawDetailRows(pdfDoc, state, { fonts, rows: detailRows });
  state = drawNotes(pdfDoc, state, { fonts, value: color.notes });
  state.cursorY -= 12;
  return state;
}

export function drawEfficiencySection(
  pdfDoc,
  state,
  { fonts, locale, report, resolveItems },
) {
  const efficiency = report?.efficiency;
  if (!efficiency) return state;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(efficiency.overallScore),
    ),
    optionalRow(
      "redundancy",
      t("wardrobe.reportRedundancyLevel", undefined, locale),
      efficiency.redundancyLevel,
    ),
    optionalRow(
      "orphan",
      t("wardrobe.reportOrphanItemRisk", undefined, locale),
      efficiency.orphanItemRisk,
    ),
  ];
  const detailRows = [
    optionalRow(
      "strengths",
      t("wardrobe.reportUnderusedStrengths", undefined, locale),
      efficiency.underusedStrengths,
    ),
  ];
  const redundancies = getRedundancyRows(efficiency);
  const orphans = getOrphanRows(efficiency);
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !redundancies.length &&
    !orphans.length &&
    !hasText(efficiency.notes)
  ) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportEfficiency", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawDetailRows(pdfDoc, state, { fonts, rows: detailRows });
  state = drawReferenceRows(pdfDoc, state, {
    fonts,
    locale,
    resolveItems,
    rows: redundancies,
    title: t("wardrobe.reportNotableRedundancies", undefined, locale),
  });
  state = drawReferenceRows(pdfDoc, state, {
    fonts,
    locale,
    resolveItems,
    rows: orphans,
    title: t("wardrobe.reportPotentialOrphans", undefined, locale),
  });
  state = drawNotes(pdfDoc, state, { fonts, value: efficiency.notes });
  state.cursorY -= 12;
  return state;
}

function getRedundancyRows(efficiency) {
  return (efficiency.notableRedundancies || []).map((row, index) => ({
    ids: row?.itemIds || [],
    key: `${row?.category || "redundancy"}-${index}`,
    message: row?.message || "",
    prefix: row?.category ? formatReportValue(row.category) : "",
  }));
}

function getOrphanRows(efficiency) {
  return (efficiency.potentialOrphans || []).map((row, index) => ({
    ids: row?.itemIds || [],
    key: `orphan-${index}`,
    message: row?.reason || "",
  }));
}

function drawReferenceRows(
  pdfDoc,
  state,
  { fonts, locale, resolveItems, rows, title, tone = "warning" },
) {
  const visibleRows = rows.filter(
    (row) => hasText(row.message) || row.ids?.length,
  );
  if (!visibleRows.length) return state;

  state = drawSubsectionTitle(pdfDoc, state, { fonts, title });
  for (const row of visibleRows) {
    state = drawReferenceRow(pdfDoc, state, {
      fonts,
      locale,
      resolveItems,
      row,
      tone,
    });
  }
  state.cursorY -= SUBSECTION_GAP;
  return state;
}

function drawReferenceRow(
  pdfDoc,
  state,
  { fonts, locale, resolveItems, row, tone },
) {
  const relatedLabels = resolveRelatedItemLabels(row.ids, resolveItems);
  state = ensureReportBlockSpace(
    pdfDoc,
    state,
    measurePrefixedTextHeight({
      fonts,
      prefix: row.prefix ? `${row.prefix}:` : "",
      text: row.message,
      width: REPORT_BODY_WIDTH,
    }) +
      measureRelatedItemsHeight({
        fonts,
        labels: relatedLabels,
        locale,
        width: REPORT_BODY_WIDTH,
      }) +
      6,
  );
  drawBulletMarker(state.page, {
    tone,
    x: BULLET_X,
    y: state.cursorY,
  });
  state = drawPrefixedText(pdfDoc, state, {
    fonts,
    prefix: row.prefix ? `${row.prefix}:` : "",
    text: row.message,
    width: BULLET_BODY_WIDTH,
    x: BULLET_BODY_X,
  });
  state = drawRelatedItemsRow(pdfDoc, state, {
    fonts,
    labels: relatedLabels,
    locale,
  });
  return addBulletBottomGap(state);
}
