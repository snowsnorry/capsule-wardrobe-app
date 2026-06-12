import { t } from "../../shared/i18n/helpers.js";
import { drawRoundedRect, splitTextIntoLines } from "./wardrobePdfDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
  BULLET_BOTTOM_GAP,
  BULLET_FONT_SIZE,
  BULLET_LINE_HEIGHT,
  INK_COLOR,
  NEUTRAL_WASH_COLOR,
  REPORT_CONTENT_WIDTH,
  REPORT_CONTENT_X,
} from "./wardrobePdfOutfitConstants.js";
import {
  ensureReportBlockSpace,
  ensureReportSpace,
} from "./wardrobePdfOutfitDrawing.js";
import { getIssueBulletLayout } from "./wardrobePdfOutfitIssueLayout.js";
import {
  getReportScoreRows,
  getScoreTone,
  getToneColors,
  toPercent,
} from "./wardrobePdfOutfitReport.js";

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

export function drawScoresSection(pdfDoc, state, { fonts, locale, report }) {
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

export function drawTextListSection(
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

export function drawIssuesSection(pdfDoc, state, { fonts, locale, report }) {
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

export function drawSuggestionsSection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
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

export function drawConfidenceSection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
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
