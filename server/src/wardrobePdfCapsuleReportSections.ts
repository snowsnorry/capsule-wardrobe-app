import { t } from "../../shared/i18n/helpers.js";
import { drawRoundedRect } from "./wardrobePdfDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
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
  getScoreTone,
  getToneColors,
  toPercent,
} from "./wardrobePdfOutfitReport.js";
import {
  getCapsuleOverviewLines,
  getCapsuleReportScoreRows,
  getCapsuleReportStrengths,
  getCapsuleWeakOutfitOverviewRows,
} from "./wardrobePdfCapsuleReport.js";
import {
  drawBulletText,
  drawRichBulletText,
  measureBulletTextHeight,
  measureRichBulletHeight,
} from "./wardrobePdfCapsuleReportBullets.js";

const NESTED_BULLET_BODY_X = BULLET_BODY_X + 22;
const NESTED_BULLET_BODY_WIDTH =
  REPORT_CONTENT_WIDTH - (NESTED_BULLET_BODY_X - REPORT_CONTENT_X);
const NESTED_BULLET_X = REPORT_CONTENT_X + 27;

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
    state = drawBulletText(pdfDoc, state, {
      fonts,
      text: String(item),
      tone,
    });
  }
  state.cursorY -= 12;
  return state;
}

function drawScoresSection(pdfDoc, state, { fonts, locale, report }) {
  const rows = getCapsuleReportScoreRows(report, locale);
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
    title: t("capsule.reportScores", undefined, locale),
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

function drawOverviewSection(pdfDoc, state, { fonts, locale, report }) {
  const overviewLines = getCapsuleOverviewLines(report, locale);
  const weakOutfits = getCapsuleWeakOutfitOverviewRows(report, locale);
  if (!overviewLines.length && !weakOutfits.length) return state;

  const firstText =
    overviewLines[0] ||
    weakOutfits.find((row) => row.issue || row.suggestion)?.issue ||
    "";
  const firstTextWidth = overviewLines.length
    ? BULLET_BODY_WIDTH
    : NESTED_BULLET_BODY_WIDTH;
  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: measureBulletTextHeight(
      String(firstText),
      fonts,
      firstTextWidth,
    ),
    title: t("capsule.reportOverview", undefined, locale),
  });
  for (const line of overviewLines) {
    state = drawBulletText(pdfDoc, state, {
      fonts,
      text: String(line),
    });
  }
  for (const row of weakOutfits) {
    state = drawRichBulletText(pdfDoc, state, {
      bodyWidth: NESTED_BULLET_BODY_WIDTH,
      bodyX: NESTED_BULLET_BODY_X,
      bulletX: NESTED_BULLET_X,
      fonts,
      issue: row.issue,
      label: row.outfitLabel ? `${row.outfitLabel}:` : "",
      suggestion: row.suggestion
        ? {
            label: t("capsule.reportIssueSuggestionLabel", undefined, locale),
            text: row.suggestion,
          }
        : null,
      tone: "warning",
    });
  }
  state.cursorY -= 12;
  return state;
}

function drawIssueBullet(pdfDoc, state, { fonts, issue, locale }) {
  const message = String(issue?.message || "").trim();
  const suggestion = String(issue?.suggestion || "").trim();
  if (!message && !suggestion) return state;

  const suggestionLabel = t(
    "capsule.reportIssueSuggestionLabel",
    undefined,
    locale,
  );
  return drawRichBulletText(pdfDoc, state, {
    fonts,
    issue: message,
    suggestion: suggestion
      ? {
          label: suggestionLabel,
          text: suggestion,
        }
      : null,
    tone: "warning",
  });
}

function getIssueSectionKeepWithHeight({ firstIssue, fonts, locale, risks }) {
  if (firstIssue) {
    return measureRichBulletHeight({
      bodyWidth: BULLET_BODY_WIDTH,
      fonts,
      issue: firstIssue?.message || "",
      suggestion: firstIssue?.suggestion
        ? {
            label: t("capsule.reportIssueSuggestionLabel", undefined, locale),
            text: firstIssue.suggestion,
          }
        : null,
    });
  }

  return measureBulletTextHeight(String(risks[0]), fonts);
}

function drawIssuesSection(pdfDoc, state, { fonts, locale, report }) {
  const issues = report?.issues || [];
  const risks = (report?.cohesion?.mainRisks || []).filter(Boolean);
  if (!issues.length && !risks.length) return state;

  const firstIssue = issues.find(
    (issue) => issue?.message || issue?.suggestion,
  );
  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: getIssueSectionKeepWithHeight({
      firstIssue,
      fonts,
      locale,
      risks,
    }),
    title: t("capsule.reportIssues", undefined, locale),
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
  const messages = suggestions
    .map((suggestion) => String(suggestion?.message || "").trim())
    .filter(Boolean);
  if (!messages.length) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: measureBulletTextHeight(messages[0], fonts),
    title: t("capsule.reportSuggestions", undefined, locale),
  });
  for (const message of messages) {
    state = drawBulletText(pdfDoc, state, {
      fonts,
      text: message,
    });
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
      ? t("capsule.reportConfidence", undefined, locale)
      : `${t("capsule.reportConfidence", undefined, locale)}: ${percent}%`;
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

export function drawCapsuleReportDetailSections(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
  state = drawScoresSection(pdfDoc, state, { fonts, locale, report });
  state = drawOverviewSection(pdfDoc, state, { fonts, locale, report });
  state = drawTextListSection(pdfDoc, state, {
    fonts,
    locale,
    titleKey: "capsule.reportStrengths",
    items: getCapsuleReportStrengths(report),
  });
  state = drawIssuesSection(pdfDoc, state, { fonts, locale, report });
  state = drawSuggestionsSection(pdfDoc, state, { fonts, locale, report });
  return drawConfidenceSection(pdfDoc, state, { fonts, locale, report });
}
