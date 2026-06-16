import { t } from "../../shared/i18n/helpers.js";
import {
  REPORT_CONTENT_WIDTH,
  REPORT_CONTENT_X,
  SECONDARY_COLOR,
} from "./wardrobePdfOutfitConstants.js";
import {
  addReportPage,
  drawStaleBanner,
  drawWrappedText,
  ensureReportSpace,
  measureWrappedText,
} from "./wardrobePdfOutfitDrawing.js";
import { getToneColors, isRecord } from "./wardrobePdfOutfitReport.js";
import {
  getCapsuleReportChipValues,
  getCapsuleReportScore,
  getCapsuleReportScoreTone,
  getCapsuleReportTemperatureLabel,
  getCapsuleReportVerdictLabel,
} from "./wardrobePdfCapsuleReport.js";
import { drawCapsuleReportDetailSections } from "./wardrobePdfCapsuleReportSections.js";
import {
  drawReportChipRow,
  drawScoreGaugeBadge,
} from "./wardrobePdfReportVisuals.js";

function drawReportIntro(pdfDoc, state, { fonts, locale, reportStale }) {
  if (reportStale) {
    state = ensureReportSpace(pdfDoc, state, 40);
    state.cursorY = drawStaleBanner(state.page, {
      x: REPORT_CONTENT_X,
      y: state.cursorY,
      width: REPORT_CONTENT_WIDTH,
      font: fonts.regularFont,
      label: t("capsule.reportOutdated", undefined, locale),
    });
  }
  return state;
}

function drawScoreBadge(page, { fonts, report, x, y }) {
  const score = getCapsuleReportScore(report);
  const tone = getCapsuleReportScoreTone(report);
  const toneColors = getToneColors(tone);
  const badge = drawScoreGaugeBadge(page, { fonts, score, toneColors, x, y });
  return { ...badge, tone };
}

function drawReportSummary(pdfDoc, state, { fonts, locale, report }) {
  const summary = String(report?.verdict?.summary || "");
  const textX = REPORT_CONTENT_X + 86;
  const textWidth = REPORT_CONTENT_WIDTH - 86;
  const summaryHeight = measureWrappedText(summary, {
    font: fonts.regularFont,
    size: 11,
    lineHeight: 14.5,
    maxWidth: textWidth,
  });
  const requiredHeight = Math.max(76, 24 + summaryHeight) + 16;

  state = ensureReportSpace(pdfDoc, state, requiredHeight);
  const badge = drawScoreBadge(state.page, {
    fonts,
    report,
    x: REPORT_CONTENT_X,
    y: state.cursorY,
  });
  const toneColors = getToneColors(badge.tone);
  state.page.drawText(getCapsuleReportVerdictLabel(report, locale), {
    x: textX,
    y: state.cursorY - 4,
    font: fonts.boldFont,
    size: 16,
    color: toneColors.color,
  });
  drawWrappedText(state.page, summary, {
    x: textX,
    y: state.cursorY - 27,
    maxWidth: textWidth,
    font: fonts.regularFont,
    size: 11,
    lineHeight: 14.5,
    color: SECONDARY_COLOR,
  });
  state.cursorY -= requiredHeight;
  return state;
}

function drawReportChips(pdfDoc, state, { fonts, locale, report }) {
  const temperature = getCapsuleReportTemperatureLabel(report, locale);
  const chips = [
    temperature ? { label: temperature, type: "temperature" } : null,
    ...getCapsuleReportChipValues(report).map((label) => ({ label })),
  ].filter(Boolean);
  return drawReportChipRow(pdfDoc, state, { chips, fonts });
}

export function drawCapsuleReportPages(pdfDoc, { capsule, fonts, locale }) {
  const report = isRecord(capsule?.report) ? capsule.report : null;
  if (!report) {
    return;
  }

  let state = addReportPage(pdfDoc);
  state = drawReportIntro(pdfDoc, state, {
    fonts,
    locale,
    reportStale: Boolean(capsule?.reportStale),
  });
  state = drawReportSummary(pdfDoc, state, { fonts, locale, report });
  state = drawReportChips(pdfDoc, state, { fonts, locale, report });
  drawCapsuleReportDetailSections(pdfDoc, state, { fonts, locale, report });
}
