import { t } from "../../shared/i18n/helpers.js";
import { drawRoundedRect, splitTextIntoLines } from "./wardrobePdfDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
  BULLET_BOTTOM_GAP,
  INK_COLOR,
  NEUTRAL_WASH_COLOR,
  REPORT_CONTENT_WIDTH,
  REPORT_CONTENT_X,
  SECONDARY_COLOR,
} from "./wardrobePdfOutfitConstants.js";
import {
  drawWrappedText,
  ensureReportBlockSpace,
  ensureReportSpace,
  measureWrappedText,
} from "./wardrobePdfOutfitDrawing.js";
import { formatReportValue, toPercent } from "./wardrobePdfOutfitReport.js";
import { getToneColors } from "./wardrobePdfOutfitReport.js";
import {
  drawBulletText,
  measureBulletTextHeight,
} from "./wardrobePdfCapsuleReportBullets.js";

const VALUE_LABEL_WIDTH = 138;
const VALUE_COLUMN_GAP = 18;
const VALUE_FONT_SIZE = 10.7;
const VALUE_LINE_HEIGHT = 14.4;
const VALUE_ROW_GAP = 5;
const CHIP_FONT_SIZE = 8.7;
const CHIP_HEIGHT = 17;
const CHIP_HORIZONTAL_PADDING = 8;

export const SUBSECTION_GAP = 7;
export const REPORT_LINE_HEIGHT = VALUE_LINE_HEIGHT;
export const REPORT_BODY_WIDTH = BULLET_BODY_WIDTH;

const PROSE_DETAIL_KEYS = new Set([
  "blockers",
  "gaps",
  "limitations",
  "limits",
  "risks",
  "strengths",
]);

export function cleanString(value) {
  return String(value ?? "").trim();
}

export function hasText(value) {
  return cleanString(value).length > 0;
}

function hasItems(value) {
  return Array.isArray(value) && value.some(hasText);
}

export function percentLabel(value) {
  const percent = toPercent(value);
  return percent === null ? "" : `${percent}%`;
}

export function optionalRow(key, label, value) {
  if (Array.isArray(value)) {
    return hasItems(value) ? { key, label, value } : null;
  }
  return hasText(value) ? { key, label, value } : null;
}

function formatCompactValue(value) {
  if (Array.isArray(value)) {
    return value.filter(hasText).map(formatReportValue).join(", ");
  }
  if (typeof value === "number") return percentLabel(value) || String(value);
  if (typeof value === "string" && /^[a-z0-9_]+$/i.test(value)) {
    return formatReportValue(value);
  }
  if (typeof value === "string") return value;
  return formatReportValue(value);
}

function joinReportValues(values) {
  const separator = values.every((value) => /[.!?…]$/.test(value.trim()))
    ? " "
    : ", ";
  return values.join(separator);
}

function detailValue(row) {
  if (Array.isArray(row.value)) {
    return joinReportValues(
      row.value
        .filter(hasText)
        .map((item) =>
          PROSE_DETAIL_KEYS.has(row.key) && typeof item === "string"
            ? item
            : formatReportValue(item),
        ),
    );
  }
  if (typeof row.value === "string") return row.value;
  return formatCompactValue(row.value);
}

function getItemDisplayName(item, locale) {
  const name = cleanString(item?.name);
  if (name) return name;

  const brand = cleanString(item?.brand);
  const category = cleanString(item?.category);
  if (brand && category) return `${brand} ${formatReportValue(category)}`;
  if (brand) return brand;
  if (category) return formatReportValue(category);

  return t(
    "wardrobe.reportUnnamedItem",
    { id: cleanString(item?.id) || "-" },
    locale,
  );
}

function addLookupId(map, id, label) {
  const normalized = cleanString(id);
  if (normalized && !map.has(normalized)) map.set(normalized, label);
}

export function createItemResolver(products, locale) {
  const namesById = new Map();
  for (const item of products || []) {
    const label = getItemDisplayName(item, locale);
    addLookupId(namesById, item?.id, label);
    addLookupId(namesById, item?.wardrobeId, label);
  }

  return (ids) =>
    (ids || [])
      .map(cleanString)
      .filter(Boolean)
      .map(
        (id) =>
          namesById.get(id) || t("wardrobe.reportUnnamedItem", { id }, locale),
      );
}

export function resolveRelatedItemLabels(ids, resolveItems) {
  return resolveItems(ids);
}

export function drawReportSectionTitle(
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

export function drawSubsectionTitle(pdfDoc, state, { fonts, title }) {
  if (!hasText(title)) return state;
  state = ensureReportSpace(pdfDoc, state, 18);
  state.page.drawText(title, {
    x: REPORT_CONTENT_X,
    y: state.cursorY,
    font: fonts.boldFont,
    size: 11,
    color: INK_COLOR,
  });
  state.cursorY -= 17;
  return state;
}

export function drawValueRows(
  pdfDoc,
  state,
  {
    fonts,
    labelWidth = VALUE_LABEL_WIDTH,
    rowX = REPORT_CONTENT_X,
    rows,
    width = REPORT_CONTENT_WIDTH,
  },
) {
  const visibleRows = rows.filter(Boolean);
  if (!visibleRows.length) return state;

  const bodyX = rowX + labelWidth + VALUE_COLUMN_GAP;
  const bodyWidth = width - labelWidth - VALUE_COLUMN_GAP;
  for (const row of visibleRows) {
    const value = formatCompactValue(row.value);
    const valueHeight = measureWrappedText(value, {
      font: fonts.regularFont,
      size: VALUE_FONT_SIZE,
      lineHeight: VALUE_LINE_HEIGHT,
      maxWidth: bodyWidth,
    });
    const rowHeight = Math.max(VALUE_LINE_HEIGHT, valueHeight) + VALUE_ROW_GAP;
    state = ensureReportBlockSpace(pdfDoc, state, rowHeight);
    state.page.drawText(row.label, {
      x: rowX,
      y: state.cursorY,
      font: fonts.boldFont,
      size: VALUE_FONT_SIZE,
      color: INK_COLOR,
    });
    drawWrappedText(state.page, value, {
      x: bodyX,
      y: state.cursorY,
      maxWidth: bodyWidth,
      font: fonts.regularFont,
      size: VALUE_FONT_SIZE,
      lineHeight: VALUE_LINE_HEIGHT,
      color: INK_COLOR,
    });
    state.cursorY -= rowHeight;
  }

  return state;
}

export function drawDetailRows(pdfDoc, state, { fonts, rows }) {
  const visibleRows = rows.filter(Boolean);
  if (!visibleRows.length) return state;

  for (const row of visibleRows) {
    const value = detailValue(row);
    const valueHeight = measureWrappedText(value, {
      font: fonts.regularFont,
      size: VALUE_FONT_SIZE,
      lineHeight: VALUE_LINE_HEIGHT,
      maxWidth: BULLET_BODY_WIDTH,
    });
    state = ensureReportBlockSpace(
      pdfDoc,
      state,
      VALUE_LINE_HEIGHT + valueHeight + VALUE_ROW_GAP,
    );
    state.page.drawText(row.label, {
      x: REPORT_CONTENT_X,
      y: state.cursorY,
      font: fonts.boldFont,
      size: VALUE_FONT_SIZE,
      color: INK_COLOR,
    });
    state.cursorY -= VALUE_LINE_HEIGHT;
    drawWrappedText(state.page, value, {
      x: REPORT_CONTENT_X,
      y: state.cursorY,
      maxWidth: REPORT_CONTENT_WIDTH,
      font: fonts.regularFont,
      size: VALUE_FONT_SIZE,
      lineHeight: VALUE_LINE_HEIGHT,
      color: INK_COLOR,
    });
    state.cursorY -= valueHeight + VALUE_ROW_GAP;
  }

  return state;
}

export function drawNotes(pdfDoc, state, { fonts, value }) {
  const text = cleanString(value);
  if (!text) return state;
  const height = measureWrappedText(text, {
    font: fonts.regularFont,
    size: VALUE_FONT_SIZE,
    lineHeight: VALUE_LINE_HEIGHT,
    maxWidth: REPORT_CONTENT_WIDTH,
  });
  state = ensureReportBlockSpace(pdfDoc, state, height + VALUE_ROW_GAP);
  drawWrappedText(state.page, text, {
    x: REPORT_CONTENT_X,
    y: state.cursorY,
    maxWidth: REPORT_CONTENT_WIDTH,
    font: fonts.regularFont,
    size: VALUE_FONT_SIZE,
    lineHeight: VALUE_LINE_HEIGHT,
    color: INK_COLOR,
  });
  state.cursorY -= height + VALUE_ROW_GAP;
  return state;
}

export function getInlineChipLayout(label, fonts) {
  const text = formatReportValue(label);
  const width =
    fonts.boldFont.widthOfTextAtSize(text, CHIP_FONT_SIZE) +
    CHIP_HORIZONTAL_PADDING * 2;
  return {
    height: CHIP_HEIGHT,
    label: text,
    width,
  };
}

export function drawInlineChip(page, { fonts, label, x, y }) {
  const layout = getInlineChipLayout(label, fonts);
  drawRoundedRect(page, {
    x,
    y: y - 4,
    width: layout.width,
    height: layout.height,
    radius: CHIP_HEIGHT / 2,
    color: NEUTRAL_WASH_COLOR,
  });
  page.drawText(layout.label, {
    x: x + CHIP_HORIZONTAL_PADDING,
    y: y + 1,
    font: fonts.boldFont,
    size: CHIP_FONT_SIZE,
    color: SECONDARY_COLOR,
  });
  return layout;
}

export function drawBulletMarker(page, { tone = "success", x, y }) {
  const toneColors = getToneColors(tone);
  page.drawCircle({
    x,
    y: y + 3,
    size: 2.9,
    color: toneColors.color,
  });
}

export function severityToReportTone(severity) {
  const normalized = cleanString(severity).toLowerCase();
  if (normalized === "critical") return "error";
  if (normalized === "warning") return "warning";
  return "neutral";
}

function buildPrefixedTextLines({ fonts, prefix, text, width }) {
  const prefixText = cleanString(prefix);
  const bodyText = cleanString(text);
  const prefixWidth = prefixText
    ? fonts.boldFont.widthOfTextAtSize(prefixText, VALUE_FONT_SIZE)
    : 0;
  const spaceWidth =
    prefixText && bodyText
      ? fonts.regularFont.widthOfTextAtSize(" ", VALUE_FONT_SIZE)
      : 0;
  const firstBodyWidth = Math.max(1, width - prefixWidth - spaceWidth);
  const firstBodyLines = bodyText
    ? splitTextIntoLines(
        bodyText,
        fonts.regularFont,
        VALUE_FONT_SIZE,
        firstBodyWidth,
      )
    : [];
  const firstLine = [
    prefixText ? { font: fonts.boldFont, text: prefixText } : null,
    prefixText && firstBodyLines[0]
      ? { font: fonts.regularFont, text: " " }
      : null,
    firstBodyLines[0]
      ? { font: fonts.regularFont, text: firstBodyLines[0] }
      : null,
  ].filter(Boolean);
  const remainingText = firstBodyLines.slice(1).join(" ");
  return [
    firstLine,
    ...splitTextIntoLines(
      remainingText,
      fonts.regularFont,
      VALUE_FONT_SIZE,
      width,
    ).map((line) => [{ font: fonts.regularFont, text: line }]),
  ].filter((line) => line.length);
}

export function measurePrefixedTextHeight({ fonts, prefix = "", text, width }) {
  return (
    buildPrefixedTextLines({ fonts, prefix, text, width }).length *
    VALUE_LINE_HEIGHT
  );
}

export function drawPrefixedText(
  pdfDoc,
  state,
  { fonts, prefix = "", text, x, width },
) {
  const lines = buildPrefixedTextLines({ fonts, prefix, text, width });
  for (const line of lines) {
    state = ensureReportSpace(pdfDoc, state, VALUE_LINE_HEIGHT + 2);
    let cursorX = x;
    for (const segment of line) {
      state.page.drawText(segment.text, {
        x: cursorX,
        y: state.cursorY,
        font: segment.font,
        size: VALUE_FONT_SIZE,
        color: INK_COLOR,
      });
      cursorX += segment.font.widthOfTextAtSize(segment.text, VALUE_FONT_SIZE);
    }
    state.cursorY -= VALUE_LINE_HEIGHT;
  }
  return state;
}

export function measureRelatedItemsHeight({ fonts, labels, locale, width }) {
  if (!labels.length) return 0;
  return measurePrefixedTextHeight({
    fonts,
    prefix: t("wardrobe.reportRelatedItems", undefined, locale),
    text: labels.join(", "),
    width,
  });
}

export function drawRelatedItemsRow(
  pdfDoc,
  state,
  { fonts, labels, locale, x = BULLET_BODY_X, width = BULLET_BODY_WIDTH },
) {
  if (!labels.length) return state;
  return drawPrefixedText(pdfDoc, state, {
    fonts,
    prefix: t("wardrobe.reportRelatedItems", undefined, locale),
    text: labels.join(", "),
    x,
    width,
  });
}

export function addBulletBottomGap(state) {
  state.cursorY -= BULLET_BOTTOM_GAP;
  return state;
}

function drawBulletItems(pdfDoc, state, { fonts, items, tone = "success" }) {
  for (const item of items.filter(Boolean)) {
    state = drawBulletText(pdfDoc, state, {
      fonts,
      text: String(item),
      tone,
    });
  }
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
  state = drawBulletItems(pdfDoc, state, { fonts, items: values, tone });
  state.cursorY -= 12;
  return state;
}
