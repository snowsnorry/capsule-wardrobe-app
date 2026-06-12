import { t } from "../../shared/i18n/helpers.js";
import { drawRoundedRect } from "./wardrobePdfDrawing.js";
import {
  INK_COLOR,
  NEUTRAL_WASH_COLOR,
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
import {
  drawConfidenceSection,
  drawIssuesSection,
  drawScoresSection,
  drawSuggestionsSection,
  drawTextListSection,
} from "./wardrobePdfOutfitReportSections.js";
import {
  formatReportValue,
  getReportChipValues,
  getReportScore,
  getReportVerdictLabel,
  getScoreTone,
  getToneColors,
  isRecord,
} from "./wardrobePdfOutfitReport.js";

function drawReportIntro(pdfDoc, state, { fonts, locale, reportStale }) {
  if (reportStale) {
    state = ensureReportSpace(pdfDoc, state, 40);
    state.cursorY = drawStaleBanner(state.page, {
      x: REPORT_CONTENT_X,
      y: state.cursorY,
      width: REPORT_CONTENT_WIDTH,
      font: fonts.regularFont,
      label: t("outfit.reportOutdated", undefined, locale),
    });
  }
  return state;
}

function drawScoreBadge(page, { fonts, report, x, y }) {
  const score = getReportScore(report);
  const tone = getScoreTone(score);
  const toneColors = getToneColors(tone);
  const size = 62;
  const centerX = x + size / 2;
  const centerY = y - size / 2;

  page.drawCircle({
    x: centerX,
    y: centerY,
    size: size / 2,
    color: toneColors.wash,
    borderColor: toneColors.color,
    borderWidth: 2,
  });
  const label = score === null ? "-" : String(score);
  const textSize = score === null ? 22 : 24;
  const textWidth = fonts.boldFont.widthOfTextAtSize(label, textSize);
  page.drawText(label, {
    x: centerX - textWidth / 2,
    y: centerY - textSize / 3,
    font: fonts.boldFont,
    size: textSize,
    color: toneColors.color,
  });
  return { height: size, tone };
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
  state.page.drawText(getReportVerdictLabel(report, locale), {
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
  const chips = getReportChipValues(report, locale);
  if (!chips.length) return state;

  let cursorX = REPORT_CONTENT_X;
  let cursorY;
  const chipHeight = 20;
  const rowHeight = 27;
  const maxX = REPORT_CONTENT_X + REPORT_CONTENT_WIDTH;

  state = ensureReportSpace(pdfDoc, state, rowHeight * 2);
  cursorY = state.cursorY;

  for (const chip of chips) {
    const label = formatReportValue(chip);
    const labelSize = 9.2;
    const labelWidth = fonts.boldFont.widthOfTextAtSize(label, labelSize);
    const chipWidth = Math.min(labelWidth + 20, REPORT_CONTENT_WIDTH);
    if (cursorX > REPORT_CONTENT_X && cursorX + chipWidth > maxX) {
      cursorX = REPORT_CONTENT_X;
      cursorY -= rowHeight;
      state = ensureReportSpace(pdfDoc, { ...state, cursorY }, rowHeight);
      cursorY = state.cursorY;
    }
    const chipY = cursorY - chipHeight;
    drawRoundedRect(state.page, {
      x: cursorX,
      y: chipY,
      width: chipWidth,
      height: chipHeight,
      radius: 10,
      color: NEUTRAL_WASH_COLOR,
    });
    state.page.drawText(label, {
      x: cursorX + 10,
      y: chipY + 5.6,
      font: fonts.boldFont,
      size: labelSize,
      color: INK_COLOR,
    });
    cursorX += chipWidth + 8;
  }

  state.cursorY = cursorY - rowHeight - 14;
  return state;
}

export function drawOutfitReportPages(pdfDoc, { fonts, locale, outfit }) {
  const report = isRecord(outfit?.report) ? outfit.report : null;
  if (!report) {
    return;
  }

  let state = addReportPage(pdfDoc);
  state = drawReportIntro(pdfDoc, state, {
    fonts,
    locale,
    reportStale: Boolean(outfit?.reportStale),
  });
  state = drawReportSummary(pdfDoc, state, { fonts, locale, report });
  state = drawReportChips(pdfDoc, state, { fonts, locale, report });
  state = drawScoresSection(pdfDoc, state, { fonts, locale, report });
  state = drawTextListSection(pdfDoc, state, {
    fonts,
    locale,
    titleKey: "outfit.reportStrengths",
    items: report?.compatibility?.mainStrengths,
  });
  state = drawIssuesSection(pdfDoc, state, { fonts, locale, report });
  state = drawSuggestionsSection(pdfDoc, state, { fonts, locale, report });
  drawConfidenceSection(pdfDoc, state, { fonts, locale, report });
}
