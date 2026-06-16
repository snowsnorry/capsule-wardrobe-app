import { LineCapStyle } from "pdf-lib";
import { drawRoundedRect } from "./wardrobePdfDrawing.js";
import {
  INK_COLOR,
  NEUTRAL_WASH_COLOR,
  REPORT_CONTENT_WIDTH,
  REPORT_CONTENT_X,
} from "./wardrobePdfOutfitConstants.js";
import {
  drawWrappedText,
  ensureReportSpace,
  measureWrappedText,
} from "./wardrobePdfOutfitDrawing.js";
import { formatReportValue } from "./wardrobePdfOutfitReport.js";

const CHIP_LABEL_SIZE = 9.2;
const CHIP_HORIZONTAL_PADDING = 10;
const CHIP_ICON_SIZE = 11;
const CHIP_ICON_GAP = 6;
const FA_TEMPERATURE_HALF_PATH =
  "M160 64c-26.5 0-48 21.5-48 48l0 164.5c0 17.3-7.1 31.9-15.3 42.5C86.2 332.6 80 349.5 80 368c0 44.2 35.8 80 80 80s80-35.8 80-80c0-18.5-6.2-35.4-16.7-48.9c-8.2-10.6-15.3-25.2-15.3-42.5L208 112c0-26.5-21.5-48-48-48zM48 112C48 50.2 98.1 0 160 0s112 50.1 112 112l0 164.4c0 .1 .1 .3 .2 .6c.2 .6 .8 1.6 1.7 2.8c18.9 24.4 30.1 55 30.1 88.1c0 79.5-64.5 144-144 144S16 447.5 16 368c0-33.2 11.2-63.8 30.1-88.1c.9-1.2 1.5-2.2 1.7-2.8c.1-.3 .2-.5 .2-.6L48 112zM208 368c0 26.5-21.5 48-48 48s-48-21.5-48-48c0-20.9 13.4-38.7 32-45.3L144 208c0-8.8 7.2-16 16-16s16 7.2 16 16l0 114.7c18.6 6.6 32 24.4 32 45.3z";

export function drawScoreGaugeBadge(page, { fonts, score, toneColors, x, y }) {
  const size = 62;
  const centerX = x + size / 2;
  const centerY = y - size / 2;
  const ringRadius = 25;
  const ringStrokeWidth = 4.9;
  const progress = Math.min(100, Math.max(0, score ?? 0)) / 100;

  page.drawCircle({
    x: centerX,
    y: centerY,
    size: ringRadius,
    borderColor: toneColors.wash,
    borderWidth: ringStrokeWidth,
  });
  drawScoreProgressRing(page, {
    centerX,
    centerY,
    color: toneColors.color,
    progress,
    radius: ringRadius,
    strokeWidth: ringStrokeWidth,
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
  return { height: size };
}

function drawScoreProgressRing(
  page,
  { centerX, centerY, color, progress, radius, strokeWidth },
) {
  if (progress <= 0) return;

  if (progress >= 0.995) {
    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius,
      borderColor: color,
      borderWidth: strokeWidth,
    });
    return;
  }

  const totalAngle = Math.PI * 2 * progress;
  const segmentCount = Math.max(4, Math.ceil(progress * 72));
  const startAngle = Math.PI / 2;
  for (let index = 0; index < segmentCount; index += 1) {
    const from = startAngle - (totalAngle * index) / segmentCount;
    const to = startAngle - (totalAngle * (index + 1)) / segmentCount;
    page.drawLine({
      start: {
        x: centerX + Math.cos(from) * radius,
        y: centerY + Math.sin(from) * radius,
      },
      end: {
        x: centerX + Math.cos(to) * radius,
        y: centerY + Math.sin(to) * radius,
      },
      thickness: strokeWidth,
      color,
      lineCap: LineCapStyle.Round,
    });
  }
}

function getChipTextHeight(label, font, maxTextWidth) {
  return measureWrappedText(label, {
    font,
    size: CHIP_LABEL_SIZE,
    lineHeight: 11,
    maxWidth: maxTextWidth,
  });
}

function drawTemperatureIcon(page, { x, y }) {
  const iconHeight = CHIP_ICON_SIZE;
  const iconWidth = (320 / 512) * iconHeight;
  page.drawSvgPath(FA_TEMPERATURE_HALF_PATH, {
    x: x + (CHIP_ICON_SIZE - iconWidth) / 2,
    y: y + iconHeight,
    scale: iconHeight / 512,
    color: INK_COLOR,
  });
}

function getChipLayout(chip, fonts) {
  const label = formatReportValue(chip.label);
  const hasIcon = chip.type === "temperature";
  const iconWidth = hasIcon ? CHIP_ICON_SIZE + CHIP_ICON_GAP : 0;
  const maxTextWidth =
    REPORT_CONTENT_WIDTH - CHIP_HORIZONTAL_PADDING * 2 - iconWidth;
  const labelWidth = fonts.boldFont.widthOfTextAtSize(label, CHIP_LABEL_SIZE);
  const textHeight = getChipTextHeight(label, fonts.boldFont, maxTextWidth);
  const chipWidth = Math.min(
    labelWidth + CHIP_HORIZONTAL_PADDING * 2 + iconWidth,
    REPORT_CONTENT_WIDTH,
  );
  const chipHeight = Math.max(20, textHeight + 10);
  return { chipHeight, chipWidth, hasIcon, label, maxTextWidth };
}

export function drawReportChipRow(pdfDoc, state, { chips, fonts }) {
  const values = (chips || []).filter(Boolean);
  if (!values.length) return state;

  let cursorX = REPORT_CONTENT_X;
  let cursorY;
  let rowHeight = 0;
  const maxX = REPORT_CONTENT_X + REPORT_CONTENT_WIDTH;

  state = ensureReportSpace(pdfDoc, state, 54);
  cursorY = state.cursorY;

  for (const chip of values) {
    const { chipHeight, chipWidth, hasIcon, label, maxTextWidth } =
      getChipLayout(chip, fonts);
    if (cursorX > REPORT_CONTENT_X && cursorX + chipWidth > maxX) {
      cursorX = REPORT_CONTENT_X;
      cursorY -= rowHeight + 7;
      rowHeight = 0;
      state = ensureReportSpace(pdfDoc, { ...state, cursorY }, chipHeight + 7);
      cursorY = state.cursorY;
    }
    rowHeight = Math.max(rowHeight, chipHeight);
    const chipY = cursorY - chipHeight;
    drawRoundedRect(state.page, {
      x: cursorX,
      y: chipY,
      width: chipWidth,
      height: chipHeight,
      radius: 10,
      color: NEUTRAL_WASH_COLOR,
    });
    const labelX =
      cursorX +
      CHIP_HORIZONTAL_PADDING +
      (hasIcon ? CHIP_ICON_SIZE + CHIP_ICON_GAP : 0);
    if (hasIcon) {
      drawTemperatureIcon(state.page, {
        x: cursorX + CHIP_HORIZONTAL_PADDING,
        y: chipY + chipHeight / 2 - CHIP_ICON_SIZE / 2,
      });
    }
    drawWrappedText(state.page, label, {
      x: labelX,
      y: chipY + chipHeight - 13.7,
      maxWidth: maxTextWidth,
      font: fonts.boldFont,
      size: CHIP_LABEL_SIZE,
      lineHeight: 11,
      color: INK_COLOR,
    });
    cursorX += chipWidth + 8;
  }

  state.cursorY = cursorY - rowHeight - 14;
  return state;
}
