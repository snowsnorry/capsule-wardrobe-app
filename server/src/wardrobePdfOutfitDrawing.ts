import { PAGE_HEIGHT, PAGE_WIDTH } from "./wardrobePdfCore.js";
import { drawRoundedRect, splitTextIntoLines } from "./wardrobePdfDrawing.js";
import {
  INK_COLOR,
  REPORT_CONTENT_BOTTOM,
  REPORT_CONTENT_TOP,
  WARNING_COLOR,
  WARNING_WASH_COLOR,
} from "./wardrobePdfOutfitConstants.js";

export function drawWrappedText(page, text, options) {
  const { color = INK_COLOR, font, lineHeight, maxWidth, size, x, y } = options;
  const lines = splitTextIntoLines(text, font, size, maxWidth);
  let cursorY = y;

  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, font, size, color });
    cursorY -= lineHeight;
  }

  return cursorY;
}

export function measureWrappedText(text, { font, lineHeight, maxWidth, size }) {
  return splitTextIntoLines(text, font, size, maxWidth).length * lineHeight;
}

function getReportPageCapacity() {
  return REPORT_CONTENT_TOP - REPORT_CONTENT_BOTTOM;
}

export function addReportPage(pdfDoc) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { page, cursorY: REPORT_CONTENT_TOP };
}

export function ensureReportSpace(pdfDoc, state, requiredHeight) {
  if (state.cursorY - requiredHeight >= REPORT_CONTENT_BOTTOM) {
    return state;
  }

  return addReportPage(pdfDoc);
}

export function ensureReportBlockSpace(pdfDoc, state, requiredHeight) {
  if (requiredHeight > getReportPageCapacity()) {
    return state;
  }

  return ensureReportSpace(pdfDoc, state, requiredHeight);
}

export function drawStaleBanner(page, { font, label, x, y, width }) {
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
