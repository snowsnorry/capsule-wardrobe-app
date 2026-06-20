import { t } from "../../shared/i18n/helpers.js";
import { drawRoundedRect } from "./wardrobePdfDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
  BULLET_BOTTOM_GAP,
  INK_COLOR,
  NEUTRAL_WASH_COLOR,
  REPORT_CONTENT_WIDTH,
  REPORT_CONTENT_X,
} from "./wardrobePdfOutfitConstants.js";
import {
  ensureReportBlockSpace,
  ensureReportSpace,
} from "./wardrobePdfOutfitDrawing.js";
import {
  formatReportValue,
  getScoreTone,
  getToneColors,
} from "./wardrobePdfOutfitReport.js";
import { getPersonalItemsReportScoreRows } from "./wardrobePdfPersonalItemsReport.js";
import {
  addBulletBottomGap,
  cleanString,
  drawBulletMarker,
  drawDetailRows,
  drawNotes,
  drawPrefixedText,
  drawReportSectionTitle,
  drawValueRows,
  hasText,
  measurePrefixedTextHeight,
  optionalRow,
  percentLabel,
  severityToReportTone,
} from "./wardrobePdfPersonalItemsReportPrimitives.js";

const BULLET_X = REPORT_CONTENT_X + 5;

export function drawScoresSection(pdfDoc, state, { fonts, locale, report }) {
  const rows = getPersonalItemsReportScoreRows(report, locale);
  if (!rows.length) return state;
  const labelFontSize = 10.8;
  const percentFontSize = 10.8;
  const percentWidth = 42;
  const labelToBarGap = 20;
  const barToPercentGap = 16;
  const maxLabelWidth = Math.max(
    ...rows.map((row) =>
      fonts.regularFont.widthOfTextAtSize(row.label, labelFontSize),
    ),
  );
  const barX = REPORT_CONTENT_X + maxLabelWidth + labelToBarGap;
  const barWidth =
    REPORT_CONTENT_WIDTH -
    maxLabelWidth -
    labelToBarGap -
    barToPercentGap -
    percentWidth;
  const percentX = barX + barWidth + barToPercentGap;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: 22,
    title: t("wardrobe.reportScores", undefined, locale),
  });

  for (const row of rows) {
    state = ensureReportSpace(pdfDoc, state, 22);
    const toneColors = getToneColors(getScoreTone(row.percent));
    state.page.drawText(row.label, {
      x: REPORT_CONTENT_X,
      y: state.cursorY,
      font: fonts.regularFont,
      size: labelFontSize,
      color: INK_COLOR,
    });
    drawRoundedRect(state.page, {
      x: barX,
      y: state.cursorY - 0.5,
      width: barWidth,
      height: 5.5,
      radius: 2.75,
      color: NEUTRAL_WASH_COLOR,
    });
    drawRoundedRect(state.page, {
      x: barX,
      y: state.cursorY - 0.5,
      width: barWidth * (row.percent / 100),
      height: 5.5,
      radius: 2.75,
      color: toneColors.color,
    });
    state.page.drawText(`${row.percent}%`, {
      x: percentX,
      y: state.cursorY,
      font: fonts.boldFont,
      size: percentFontSize,
      color: toneColors.color,
    });
    state.cursorY -= 20;
  }

  state.cursorY -= 14;
  return state;
}

export function drawOverviewSection(pdfDoc, state, { fonts, locale, report }) {
  const { detailRows, rows } = getPersonalItemsReportOverviewRowGroups(
    report,
    locale,
  );
  if (!rows.some(Boolean) && !detailRows.some(Boolean)) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: 28,
    title: t("wardrobe.reportOverview", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawDetailRows(pdfDoc, state, { fonts, rows: detailRows });
  state.cursorY -= 12;
  return state;
}

export function getPersonalItemsReportOverviewRowGroups(report, locale) {
  const overview = report?.personalItemsOverview;
  if (!overview) return { detailRows: [], rows: [] };

  return {
    detailRows: [
      optionalRow(
        "tags",
        t("wardrobe.reportSummaryTags", undefined, locale),
        overview.summaryTags,
      ),
    ],
    rows: [
      optionalRow(
        "balance",
        t("wardrobe.reportDetectedCategoryBalance", undefined, locale),
        overview.detectedCategoryBalance,
      ),
      optionalRow(
        "styles",
        t("wardrobe.reportDominantStyles", undefined, locale),
        overview.dominantStyles,
      ),
      optionalRow(
        "seasons",
        t("wardrobe.reportDominantSeasons", undefined, locale),
        overview.dominantSeasons,
      ),
      optionalRow(
        "formality",
        t("wardrobe.reportDominantFormalityLevels", undefined, locale),
        overview.dominantFormalityLevels,
      ),
    ],
  };
}

export function drawCoverageSection(pdfDoc, state, { fonts, locale, report }) {
  const coverage = report?.coverage;
  if (!coverage) return state;

  const core = coverage.coreRoleCoverage || {};
  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(coverage.overallScore),
    ),
    optionalRow(
      "tops",
      t("wardrobe.reportRoleTops", undefined, locale),
      core.tops,
    ),
    optionalRow(
      "bottoms",
      t("wardrobe.reportRoleBottoms", undefined, locale),
      core.bottoms,
    ),
    optionalRow(
      "shoes",
      t("wardrobe.reportRoleShoes", undefined, locale),
      core.shoes,
    ),
    optionalRow(
      "layers",
      t("wardrobe.reportRoleLayers", undefined, locale),
      core.layers,
    ),
    optionalRow(
      "dresses",
      t("wardrobe.reportRoleDresses", undefined, locale),
      core.dresses,
    ),
    optionalRow(
      "accessories",
      t("wardrobe.reportRoleAccessories", undefined, locale),
      core.accessories,
    ),
    optionalRow(
      "missing",
      t("wardrobe.reportMissingCategories", undefined, locale),
      coverage.missingCategories,
    ),
    optionalRow(
      "weak",
      t("wardrobe.reportWeakCategories", undefined, locale),
      coverage.weakCategories,
    ),
    optionalRow(
      "overrepresented",
      t("wardrobe.reportOverrepresentedCategories", undefined, locale),
      coverage.overrepresentedCategories,
    ),
  ];
  const bottlenecks = getCoverageBottleneckRows(coverage);
  if (!rows.some(Boolean) && !bottlenecks.length && !hasText(coverage.notes)) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportCoverage", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawCoverageBottlenecks(pdfDoc, state, {
    fonts,
    rows: bottlenecks,
  });
  state = drawNotes(pdfDoc, state, { fonts, value: coverage.notes });
  state.cursorY -= 12;
  return state;
}

export function getCoverageBottleneckRows(coverage) {
  return (coverage.bottlenecks || [])
    .filter((row) => hasText(row?.message))
    .map((row) => ({
      message: cleanString(row?.message),
      prefix: row?.category ? `${formatReportValue(row.category)}:` : "",
      tone: severityToReportTone(row?.severity),
    }));
}

function drawCoverageBottlenecks(pdfDoc, state, { fonts, rows }) {
  for (const row of rows) {
    state = ensureReportBlockSpace(
      pdfDoc,
      state,
      measurePrefixedTextHeight({
        fonts,
        prefix: row.prefix,
        text: row.message,
        width: BULLET_BODY_WIDTH,
      }) + BULLET_BOTTOM_GAP,
    );
    drawBulletMarker(state.page, {
      tone: row.tone,
      x: BULLET_X,
      y: state.cursorY,
    });
    state = drawPrefixedText(pdfDoc, state, {
      fonts,
      prefix: row.prefix,
      text: row.message,
      width: BULLET_BODY_WIDTH,
      x: BULLET_BODY_X,
    });
    state = addBulletBottomGap(state);
  }
  return state;
}

function getEstimatedOutfitRangeLabel(range, locale) {
  if (range?.min == null && range?.max == null) return "";
  return t(
    "wardrobe.reportEstimatedOutfitRangeValue",
    {
      confidence: formatReportValue(range?.confidence),
      max: range?.max ?? "-",
      min: range?.min ?? "-",
    },
    locale,
  );
}

export function drawOutfitReadinessSection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
  const readiness = report?.outfitReadiness;
  if (!readiness) return state;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(readiness.overallScore),
    ),
  ];
  const detailRows = [
    optionalRow(
      "formulas",
      t("wardrobe.reportSupportedFormulaTypes", undefined, locale),
      readiness.supportedFormulaTypes,
    ),
    optionalRow(
      "range",
      t("wardrobe.reportEstimatedOutfitRange", undefined, locale),
      getEstimatedOutfitRangeLabel(readiness.estimatedOutfitRange, locale),
    ),
    optionalRow(
      "blockers",
      t("wardrobe.reportMainBlockers", undefined, locale),
      readiness.mainBlockers,
    ),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !hasText(readiness.notes)
  ) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportOutfitReadiness", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawDetailRows(pdfDoc, state, { fonts, rows: detailRows });
  state = drawNotes(pdfDoc, state, { fonts, value: readiness.notes });
  state.cursorY -= 12;
  return state;
}

export function drawVersatilitySection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
  const versatility = report?.versatility;
  if (!versatility) return state;

  const rows = [
    optionalRow(
      "overall",
      t("wardrobe.reportOverallScore", undefined, locale),
      percentLabel(versatility.overallScore),
    ),
    optionalRow(
      "mix",
      t("wardrobe.reportMixAndMatchScore", undefined, locale),
      percentLabel(versatility.mixAndMatchScore),
    ),
    optionalRow(
      "repeatability",
      t("wardrobe.reportRepeatabilityScore", undefined, locale),
      percentLabel(versatility.repeatabilityScore),
    ),
    optionalRow(
      "variety",
      t("wardrobe.reportOutfitVariety", undefined, locale),
      versatility.outfitVariety,
    ),
    optionalRow(
      "modes",
      t("wardrobe.reportPrimaryUseModes", undefined, locale),
      versatility.primaryUseModes,
    ),
  ];
  const detailRows = [
    optionalRow(
      "limits",
      t("wardrobe.reportLimitingFactors", undefined, locale),
      versatility.limitingFactors,
    ),
  ];
  if (
    !rows.some(Boolean) &&
    !detailRows.some(Boolean) &&
    !hasText(versatility.notes)
  ) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    title: t("wardrobe.reportVersatility", undefined, locale),
  });
  state = drawValueRows(pdfDoc, state, { fonts, rows });
  state = drawDetailRows(pdfDoc, state, { fonts, rows: detailRows });
  state = drawNotes(pdfDoc, state, { fonts, value: versatility.notes });
  state.cursorY -= 12;
  return state;
}
