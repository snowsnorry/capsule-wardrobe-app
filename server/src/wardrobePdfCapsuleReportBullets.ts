import { splitTextIntoLines } from "./wardrobePdfDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
  BULLET_BOTTOM_GAP,
  BULLET_FONT_SIZE,
  BULLET_LINE_HEIGHT,
  INK_COLOR,
  REPORT_CONTENT_X,
} from "./wardrobePdfOutfitConstants.js";
import {
  ensureReportBlockSpace,
  ensureReportSpace,
} from "./wardrobePdfOutfitDrawing.js";
import { getToneColors } from "./wardrobePdfOutfitReport.js";

const SEGMENT_SPACE = " ";

export function measureBulletTextHeight(
  text,
  fonts,
  width = BULLET_BODY_WIDTH,
) {
  return (
    splitTextIntoLines(text, fonts.regularFont, BULLET_FONT_SIZE, width)
      .length *
      BULLET_LINE_HEIGHT +
    BULLET_BOTTOM_GAP
  );
}

export function drawBulletText(
  pdfDoc,
  state,
  {
    bodyWidth = BULLET_BODY_WIDTH,
    bodyX = BULLET_BODY_X,
    bulletX = REPORT_CONTENT_X + 5,
    fonts,
    text,
    tone = "success",
  },
) {
  const lines = splitTextIntoLines(
    text,
    fonts.regularFont,
    BULLET_FONT_SIZE,
    bodyWidth,
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
        x: bulletX,
        y: state.cursorY + 3,
        size: 2.9,
        color: toneColors.color,
      });
    }
    state.page.drawText(line, {
      x: bodyX,
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

function splitPrefixedLine({ bodyWidth, fonts, prefix, text }) {
  const prefixText = String(prefix || "").trim();
  const bodyText = String(text || "").trim();
  const prefixWidth = prefixText
    ? fonts.boldFont.widthOfTextAtSize(prefixText, BULLET_FONT_SIZE)
    : 0;
  const spaceWidth =
    prefixText && bodyText
      ? fonts.regularFont.widthOfTextAtSize(SEGMENT_SPACE, BULLET_FONT_SIZE)
      : 0;
  const firstTextWidth = Math.max(1, bodyWidth - prefixWidth - spaceWidth);
  const narrowLines = bodyText
    ? splitTextIntoLines(
        bodyText,
        fonts.regularFont,
        BULLET_FONT_SIZE,
        firstTextWidth,
      )
    : [];
  const firstLineBody = narrowLines[0] || "";
  const remainingText = narrowLines.slice(1).join(SEGMENT_SPACE);
  const lines = [
    [
      prefixText ? { font: fonts.boldFont, text: prefixText } : null,
      prefixText && firstLineBody
        ? { font: fonts.regularFont, text: SEGMENT_SPACE }
        : null,
      firstLineBody ? { font: fonts.regularFont, text: firstLineBody } : null,
    ].filter(Boolean),
  ].filter((line) => line.length);

  return [
    ...lines,
    ...splitTextIntoLines(
      remainingText,
      fonts.regularFont,
      BULLET_FONT_SIZE,
      bodyWidth,
    ).map((line) => [{ font: fonts.regularFont, text: line }]),
  ];
}

function buildRichBulletLines({ bodyWidth, fonts, issue, label, suggestion }) {
  const lines = [];
  if (label || issue) {
    lines.push(
      ...splitPrefixedLine({
        bodyWidth,
        fonts,
        prefix: label,
        text: issue,
      }),
    );
  }
  if (suggestion?.label || suggestion?.text) {
    lines.push(
      ...splitPrefixedLine({
        bodyWidth,
        fonts,
        prefix: suggestion?.label,
        text: suggestion?.text,
      }),
    );
  }
  return lines;
}

export function measureRichBulletHeight(options) {
  return (
    buildRichBulletLines(options).length * BULLET_LINE_HEIGHT +
    BULLET_BOTTOM_GAP
  );
}

export function drawRichBulletText(
  pdfDoc,
  state,
  {
    bodyWidth = BULLET_BODY_WIDTH,
    bodyX = BULLET_BODY_X,
    bulletX = REPORT_CONTENT_X + 5,
    fonts,
    issue,
    label = "",
    suggestion = null,
    tone = "warning",
  },
) {
  const lines = buildRichBulletLines({
    bodyWidth,
    fonts,
    issue,
    label,
    suggestion,
  });
  if (!lines.length) return state;

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
        x: bulletX,
        y: state.cursorY + 3,
        size: 2.9,
        color: toneColors.color,
      });
    }
    let cursorX = bodyX;
    for (const segment of line) {
      state.page.drawText(segment.text, {
        x: cursorX,
        y: state.cursorY,
        font: segment.font,
        size: BULLET_FONT_SIZE,
        color: INK_COLOR,
      });
      cursorX += segment.font.widthOfTextAtSize(segment.text, BULLET_FONT_SIZE);
    }
    state.cursorY -= BULLET_LINE_HEIGHT;
  }

  state.cursorY -= BULLET_BOTTOM_GAP;
  return state;
}
