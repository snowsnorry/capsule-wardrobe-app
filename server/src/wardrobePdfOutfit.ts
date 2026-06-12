/* eslint-disable complexity, max-lines */
import { rgb } from "pdf-lib";
import { t } from "../../shared/i18n/helpers.js";
import {
  BLOCK_RADIUS,
  CONTENT_WIDTH,
  IMAGE_BACKGROUND_COLOR,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  loadImageBytes,
} from "./wardrobePdfCore.js";
import { drawRoundedRect, splitTextIntoLines } from "./wardrobePdfDrawing.js";
import { hasNonLatinText } from "./wardrobePdfRuntime.js";

const REPORT_PAGE_PADDING = 0;
const REPORT_CONTENT_X = PAGE_MARGIN + REPORT_PAGE_PADDING;
const REPORT_CONTENT_WIDTH = CONTENT_WIDTH - REPORT_PAGE_PADDING * 2;
const REPORT_CONTENT_TOP = PAGE_HEIGHT - PAGE_MARGIN - REPORT_PAGE_PADDING;
const REPORT_CONTENT_BOTTOM = PAGE_MARGIN + REPORT_PAGE_PADDING;
const INK_COLOR = rgb(0.122, 0.161, 0.2);
const SECONDARY_COLOR = rgb(0.322, 0.376, 0.427);
const BORDER_COLOR = rgb(0.88, 0.88, 0.86);
const WARNING_COLOR = rgb(0.608, 0.416, 0.02);
const WARNING_WASH_COLOR = rgb(1, 0.945, 0.761);
const ERROR_COLOR = rgb(0.824, 0.263, 0.263);
const ERROR_WASH_COLOR = rgb(0.992, 0.886, 0.882);
const SUCCESS_COLOR = rgb(0.184, 0.561, 0.345);
const SUCCESS_WASH_COLOR = rgb(0.882, 0.952, 0.906);
const NEUTRAL_WASH_COLOR = rgb(0.945, 0.95, 0.956);
const BULLET_BODY_X = REPORT_CONTENT_X + 20;
const BULLET_BODY_WIDTH = REPORT_CONTENT_WIDTH - 20;
const BULLET_FONT_SIZE = 10.7;
const BULLET_LINE_HEIGHT = 14.4;
const BULLET_BOTTOM_GAP = 3;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toPercent(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
}

function formatReportValue(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getReportScore(report) {
  return toPercent(
    report?.verdict?.score ?? report?.compatibility?.overallScore,
  );
}

function getScoreTone(score) {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

function getToneColors(tone) {
  if (tone === "success") {
    return { color: SUCCESS_COLOR, wash: SUCCESS_WASH_COLOR };
  }
  if (tone === "warning") {
    return { color: WARNING_COLOR, wash: WARNING_WASH_COLOR };
  }
  if (tone === "error") {
    return { color: ERROR_COLOR, wash: ERROR_WASH_COLOR };
  }
  return { color: SECONDARY_COLOR, wash: NEUTRAL_WASH_COLOR };
}

function getReportTemperatureLabel(report, locale) {
  const { max, min } = report?.seasonality?.temperatureBandC || {};

  if (min != null && max != null) {
    return t("outfit.reportTemperatureRange", { max, min }, locale);
  }
  if (min != null) {
    return t("outfit.reportTemperatureFrom", { min }, locale);
  }
  if (max != null) {
    return t("outfit.reportTemperatureUpTo", { max }, locale);
  }
  return null;
}

function getReportChipValues(report, locale) {
  return [
    getReportTemperatureLabel(report, locale),
    ...(report?.seasonality?.primarySeasons || []),
    report?.styleProfile?.formalityLevel,
    report?.styleProfile?.primaryStyle,
    report?.colorAnalysis?.paletteType,
  ].filter(Boolean);
}

function getReportScoreRows(report, locale) {
  return [
    {
      key: "style",
      label: t("outfit.reportScoreStyleCoherence", undefined, locale),
      value:
        report?.compatibility?.styleCoherence ??
        report?.styleProfile?.styleScore,
    },
    {
      key: "color",
      label: t("outfit.reportScoreColorHarmony", undefined, locale),
      value:
        report?.compatibility?.colorCoherence ??
        report?.colorAnalysis?.colorScore,
    },
    {
      key: "season",
      label: t("outfit.reportScoreSeasonFit", undefined, locale),
      value:
        report?.compatibility?.seasonalCoherence ??
        report?.seasonality?.seasonScore,
    },
    {
      key: "formality",
      label: t("outfit.reportScoreFormalityCoherence", undefined, locale),
      value: report?.compatibility?.formalityCoherence,
    },
    {
      key: "overall",
      label: t("outfit.reportScoreOverallCompatibility", undefined, locale),
      value: report?.compatibility?.overallScore,
    },
  ]
    .map((row) => ({ ...row, percent: toPercent(row.value) }))
    .filter((row) => row.percent !== null);
}

function getReportVerdictLabel(report, locale) {
  const status = String(report?.verdict?.status || "").trim();
  return status
    ? t(`outfit.reportVerdict.${status}`, undefined, locale)
    : t("outfit.reportVerdict.valid", undefined, locale);
}

function drawWrappedText(page, text, options) {
  const { color = INK_COLOR, font, lineHeight, maxWidth, size, x, y } = options;
  const lines = splitTextIntoLines(text, font, size, maxWidth);
  let cursorY = y;

  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, font, size, color });
    cursorY -= lineHeight;
  }

  return cursorY;
}

function measureWrappedText(text, { font, lineHeight, maxWidth, size }) {
  return splitTextIntoLines(text, font, size, maxWidth).length * lineHeight;
}

function getReportPageCapacity() {
  return REPORT_CONTENT_TOP - REPORT_CONTENT_BOTTOM;
}

function addReportPage(pdfDoc) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { page, cursorY: REPORT_CONTENT_TOP };
}

function ensureReportSpace(pdfDoc, state, requiredHeight) {
  if (state.cursorY - requiredHeight >= REPORT_CONTENT_BOTTOM) {
    return state;
  }

  return addReportPage(pdfDoc);
}

function ensureReportBlockSpace(pdfDoc, state, requiredHeight) {
  if (requiredHeight > getReportPageCapacity()) {
    return state;
  }

  return ensureReportSpace(pdfDoc, state, requiredHeight);
}

function drawStaleBanner(page, { font, label, x, y, width }) {
  const height = 32;
  drawRoundedRect(page, {
    x,
    y: y - height + 8,
    width,
    height,
    radius: 8,
    color: WARNING_WASH_COLOR,
  });
  page.drawText(label, {
    x: x + 12,
    y: y - 11,
    font,
    size: 10,
    color: WARNING_COLOR,
  });
  return y - height - 2;
}

async function drawOutfitImageCoverPage(
  pdfDoc,
  { fonts, imageLoadStats, locale, outfit },
) {
  if (!outfit?.imageUrl) {
    return;
  }

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const title = outfit.title || t("wardrobe.newOutfit", undefined, locale);
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  cursorY = drawWrappedText(page, title, {
    x: PAGE_MARGIN,
    y: cursorY,
    maxWidth: CONTENT_WIDTH,
    font: fonts.boldFont,
    size: 26,
    lineHeight: 31,
    color: INK_COLOR,
  });

  cursorY -= 10;
  if (outfit.imageStale) {
    cursorY = drawStaleBanner(page, {
      x: PAGE_MARGIN,
      y: cursorY,
      width: CONTENT_WIDTH,
      font: fonts.regularFont,
      label: t("capsule.outfitSetImageObsolete", undefined, locale),
    });
  }

  const imageBounds = {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN,
    width: CONTENT_WIDTH,
    height: Math.max(240, cursorY - PAGE_MARGIN - 8),
  };
  drawRoundedRect(page, {
    ...imageBounds,
    radius: BLOCK_RADIUS,
    color: IMAGE_BACKGROUND_COLOR,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  const imageBytes = await loadImageBytes(
    outfit.imageUrl,
    null,
    {
      width: imageBounds.width * 2,
      height: imageBounds.height * 2,
    },
    imageLoadStats,
  );
  if (!imageBytes) {
    drawWrappedText(page, title, {
      x: imageBounds.x + 16,
      y: imageBounds.y + imageBounds.height - 24,
      maxWidth: imageBounds.width - 32,
      font: fonts.regularFont,
      size: 11,
      lineHeight: 14,
      color: SECONDARY_COLOR,
    });
    return;
  }

  const embeddedImage =
    imageBytes.kind === "jpg"
      ? await pdfDoc.embedJpg(imageBytes.bytes)
      : await pdfDoc.embedPng(imageBytes.bytes);
  const scaled = embeddedImage.scaleToFit(
    imageBounds.width - 2,
    imageBounds.height - 2,
  );
  page.drawImage(embeddedImage, {
    x: imageBounds.x + (imageBounds.width - scaled.width) / 2,
    y: imageBounds.y + (imageBounds.height - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height,
  });
}

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

function drawReportSectionTitle(
  pdfDoc,
  state,
  { fonts, keepWithHeight = 0, title },
) {
  state = ensureReportBlockSpace(pdfDoc, state, 23 + keepWithHeight);
  state.page.drawText(title, {
    x: REPORT_CONTENT_X,
    y: state.cursorY,
    font: fonts.boldFont,
    size: 14,
    color: INK_COLOR,
  });
  state.cursorY -= 23;
  return state;
}

function measureBulletTextHeight(text, fonts) {
  return (
    splitTextIntoLines(
      text,
      fonts.regularFont,
      BULLET_FONT_SIZE,
      BULLET_BODY_WIDTH,
    ).length *
      BULLET_LINE_HEIGHT +
    BULLET_BOTTOM_GAP
  );
}

function drawScoresSection(pdfDoc, state, { fonts, locale, report }) {
  const rows = getReportScoreRows(report, locale);
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
    title: t("outfit.reportScores", undefined, locale),
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

function drawBulletText(pdfDoc, state, { fonts, text, tone = "success" }) {
  const lines = splitTextIntoLines(
    text,
    fonts.regularFont,
    BULLET_FONT_SIZE,
    BULLET_BODY_WIDTH,
  );
  const toneColors = getToneColors(tone);
  state = ensureReportBlockSpace(
    pdfDoc,
    state,
    lines.length * BULLET_LINE_HEIGHT + BULLET_BOTTOM_GAP,
  );

  for (const [index, line] of lines.entries()) {
    state = ensureReportSpace(pdfDoc, state, BULLET_LINE_HEIGHT + 2);
    if (index === 0) {
      state.page.drawCircle({
        x: REPORT_CONTENT_X + 5,
        y: state.cursorY + 3,
        size: 2.9,
        color: toneColors.color,
      });
    }
    state.page.drawText(line, {
      x: BULLET_BODY_X,
      y: state.cursorY,
      font: fonts.regularFont,
      size: BULLET_FONT_SIZE,
      color: INK_COLOR,
    });
    state.cursorY -= BULLET_LINE_HEIGHT;
  }

  state.cursorY -= BULLET_BOTTOM_GAP;
  return state;
}

function splitTextWithFirstLineWidth(text, font, size, firstWidth, restWidth) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];

  const firstLineWords = [];
  while (words.length) {
    const candidate = [...firstLineWords, words[0]].join(" ");
    if (
      firstLineWords.length > 0 &&
      font.widthOfTextAtSize(candidate, size) > firstWidth
    ) {
      break;
    }
    firstLineWords.push(words.shift());
  }

  const lines = [firstLineWords.join(" ")].filter(Boolean);
  const rest = words.join(" ");
  if (rest) {
    lines.push(...splitTextIntoLines(rest, font, size, restWidth));
  }

  return lines;
}

function getIssueBulletLayout({ fonts, issue, locale }) {
  const message = String(issue?.message || "").trim();
  const suggestion = String(issue?.suggestion || "").trim();
  const suggestionLabel = t(
    "outfit.reportIssueSuggestionLabel",
    undefined,
    locale,
  );
  const suggestionLabelWidth =
    suggestionLabel && suggestion
      ? fonts.boldFont.widthOfTextAtSize(suggestionLabel, BULLET_FONT_SIZE) + 4
      : 0;
  const messageLines = message
    ? splitTextIntoLines(
        message,
        fonts.regularFont,
        BULLET_FONT_SIZE,
        BULLET_BODY_WIDTH,
      )
    : [];
  const suggestionLines = suggestion
    ? splitTextWithFirstLineWidth(
        suggestion,
        fonts.regularFont,
        BULLET_FONT_SIZE,
        BULLET_BODY_WIDTH - suggestionLabelWidth,
        BULLET_BODY_WIDTH,
      )
    : [];

  return {
    messageLines,
    suggestion,
    suggestionLabel,
    suggestionLabelWidth,
    suggestionLines,
    height:
      (messageLines.length + suggestionLines.length) * BULLET_LINE_HEIGHT +
      BULLET_BOTTOM_GAP,
  };
}

function drawIssueBullet(pdfDoc, state, { fonts, issue, locale }) {
  const layout = getIssueBulletLayout({ fonts, issue, locale });
  if (!layout.messageLines.length && !layout.suggestionLines.length) {
    return state;
  }

  const toneColors = getToneColors("warning");
  state = ensureReportBlockSpace(pdfDoc, state, layout.height);
  state.page.drawCircle({
    x: REPORT_CONTENT_X + 5,
    y: state.cursorY + 3,
    size: 2.9,
    color: toneColors.color,
  });

  for (const line of layout.messageLines) {
    state = ensureReportSpace(pdfDoc, state, BULLET_LINE_HEIGHT + 2);
    state.page.drawText(line, {
      x: BULLET_BODY_X,
      y: state.cursorY,
      font: fonts.regularFont,
      size: BULLET_FONT_SIZE,
      color: INK_COLOR,
    });
    state.cursorY -= BULLET_LINE_HEIGHT;
  }

  for (const [index, line] of layout.suggestionLines.entries()) {
    state = ensureReportSpace(pdfDoc, state, BULLET_LINE_HEIGHT + 2);
    if (index === 0) {
      state.page.drawText(layout.suggestionLabel, {
        x: BULLET_BODY_X,
        y: state.cursorY,
        font: fonts.boldFont,
        size: BULLET_FONT_SIZE,
        color: INK_COLOR,
      });
    }
    state.page.drawText(line, {
      x: BULLET_BODY_X + (index === 0 ? layout.suggestionLabelWidth : 0),
      y: state.cursorY,
      font: fonts.regularFont,
      size: BULLET_FONT_SIZE,
      color: INK_COLOR,
    });
    state.cursorY -= BULLET_LINE_HEIGHT;
  }

  state.cursorY -= BULLET_BOTTOM_GAP;
  return state;
}

function drawTextListSection(
  pdfDoc,
  state,
  { fonts, items, locale, titleKey, tone = "success" },
) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: measureBulletTextHeight(String(values[0]), fonts),
    title: t(titleKey, undefined, locale),
  });
  for (const item of values) {
    state = drawBulletText(pdfDoc, state, { fonts, text: item, tone });
  }
  state.cursorY -= 12;
  return state;
}

function drawIssuesSection(pdfDoc, state, { fonts, locale, report }) {
  const issues = report?.issues || [];
  const risks = (report?.compatibility?.mainRisks || []).filter(Boolean);
  if (!issues.length && !risks.length) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: issues.length
      ? getIssueBulletLayout({ fonts, issue: issues[0], locale }).height
      : measureBulletTextHeight(String(risks[0]), fonts),
    title: t("outfit.reportIssues", undefined, locale),
  });

  for (const issue of issues) {
    state = drawIssueBullet(pdfDoc, state, { fonts, issue, locale });
  }

  for (const risk of risks) {
    state = drawBulletText(pdfDoc, state, {
      fonts,
      text: String(risk),
      tone: "warning",
    });
  }

  state.cursorY -= 12;
  return state;
}

function drawSuggestionsSection(pdfDoc, state, { fonts, locale, report }) {
  const suggestions = report?.suggestions || [];
  if (!suggestions.length) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: measureBulletTextHeight(
      String(
        suggestions.find((suggestion) => suggestion?.message)?.message || "",
      ),
      fonts,
    ),
    title: t("outfit.reportSuggestions", undefined, locale),
  });
  for (const suggestion of suggestions) {
    const message = String(suggestion?.message || "").trim();
    if (message) {
      state = drawBulletText(pdfDoc, state, {
        fonts,
        text: message,
      });
    }
  }
  state.cursorY -= 12;
  return state;
}

function drawConfidenceSection(pdfDoc, state, { fonts, locale, report }) {
  const percent = toPercent(report?.confidence?.overall);
  const assumptions = report?.confidence?.assumptions || [];
  if (percent === null && !assumptions.length) return state;

  const title =
    percent === null
      ? t("outfit.reportConfidence", undefined, locale)
      : `${t("outfit.reportConfidence", undefined, locale)}: ${percent}%`;
  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: assumptions.length
      ? measureBulletTextHeight(String(assumptions[0]), fonts)
      : 0,
    title,
  });
  for (const assumption of assumptions) {
    state = drawBulletText(pdfDoc, state, {
      fonts,
      text: String(assumption),
    });
  }
  return state;
}

function drawOutfitReportPages(pdfDoc, { fonts, locale, outfit }) {
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

function collectReportText(value, target = []) {
  if (typeof value === "string") {
    target.push(value);
    return target;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectReportText(item, target));
    return target;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectReportText(item, target));
  }

  return target;
}

function outfitNeedsUnicodeFallback(outfit, locale) {
  if (locale === "ru") {
    return true;
  }

  return [
    outfit?.title,
    outfit?.imageUrl,
    t("capsule.outfitSetImageObsolete", undefined, locale),
    t("outfit.reportOutdated", undefined, locale),
    t("outfit.reportTitle", undefined, locale),
    ...collectReportText(outfit?.report),
  ].some(hasNonLatinText);
}

export {
  drawOutfitImageCoverPage,
  drawOutfitReportPages,
  formatReportValue,
  getReportChipValues,
  getReportScoreRows,
  getReportTemperatureLabel,
  getReportVerdictLabel,
  outfitNeedsUnicodeFallback,
  toPercent,
};
