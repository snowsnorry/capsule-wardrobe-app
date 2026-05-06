import { rgb } from "pdf-lib";
import { getPdfColorSwatchFill } from "../../shared/colorSwatches.js";
import { BOX_PADDING, BLOCK_RADIUS, SUBTLE_BLOCK_COLOR } from "./wardrobePdfCore.js";

export function splitTextIntoLines(text, font, fontSize, maxWidth) {
  const rawWords = String(text || "").split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) {
    return [];
  }

  const words = [];
  for (const rawWord of rawWords) {
    if (font.widthOfTextAtSize(rawWord, fontSize) <= maxWidth) {
      words.push(rawWord);
      continue;
    }

    let chunk = "";
    for (const char of rawWord) {
      const candidate = `${chunk}${char}`;
      if (chunk && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
        words.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }

    if (chunk) {
      words.push(chunk);
    }
  }

  const lines = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${currentLine} ${words[index]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = words[index];
  }

  lines.push(currentLine);
  return lines;
}

export function truncateLines(lines, maxLines) {
  if (lines.length <= maxLines) {
    return lines;
  }

  const truncated = lines.slice(0, maxLines);
  const lastLine = truncated[maxLines - 1] || "";
  truncated[maxLines - 1] = lastLine.replace(/[.,;:!?-]?\s*$/, "") + "...";
  return truncated;
}

export function drawRoundedRect(page, {
  x,
  y,
  width,
  height,
  radius,
  color,
  borderColor,
  borderWidth = 0
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: unknown;
  borderColor?: unknown;
  borderWidth?: number;
}) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));

  if (borderColor && borderWidth > 0) {
    drawRoundedRect(page, {
      x,
      y,
      width,
      height,
      radius: r,
      color: borderColor
    });
    drawRoundedRect(page, {
      x: x + borderWidth,
      y: y + borderWidth,
      width: Math.max(0, width - borderWidth * 2),
      height: Math.max(0, height - borderWidth * 2),
      radius: Math.max(0, r - borderWidth),
      color
    });
    return;
  }

  page.drawRectangle({
    x: x + r,
    y,
    width: Math.max(0, width - r * 2),
    height,
    color
  });
  page.drawRectangle({
    x,
    y: y + r,
    width,
    height: Math.max(0, height - r * 2),
    color
  });
  page.drawCircle({
    x: x + r,
    y: y + r,
    size: r,
    color
  });
  page.drawCircle({
    x: x + width - r,
    y: y + r,
    size: r,
    color
  });
  page.drawCircle({
    x: x + r,
    y: y + height - r,
    size: r,
    color
  });
  page.drawCircle({
    x: x + width - r,
    y: y + height - r,
    size: r,
    color
  });
}

export function addLinkAnnotation(pdfDoc, page, url, rect) {
  if (!url) {
    return;
  }

  const annotation = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: url
    }
  });
  const annotationRef = pdfDoc.context.register(annotation);
  const annots = page.node.Annots();
  if (annots) {
    annots.push(annotationRef);
  } else {
    page.node.set("Annots", pdfDoc.context.obj([annotationRef]));
  }
}

export function drawTextBlock(page, text, options) {
  const {
    x,
    y,
    width,
    font,
    size,
    lineHeight,
    color = rgb(0.12, 0.16, 0.2),
    maxLines = Infinity
  } = options;

  const lines = truncateLines(splitTextIntoLines(text, font, size, width), maxLines);
  let cursorY = y;

  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, font, size, color });
    cursorY -= lineHeight;
  }

  return cursorY;
}

export function measureTextBlockHeight(text, {
  font,
  size,
  lineHeight,
  width,
  maxLines = Infinity
}) {
  const lines = truncateLines(splitTextIntoLines(text, font, size, width), maxLines);
  return lines.length === 0 ? 0 : lines.length * lineHeight;
}

export function getRowText(row) {
  if (row?.value?.kind === "colors") {
    return row.value.items.map((item) => item.label).join(", ");
  }

  return row?.value?.text || "";
}

export function drawColorValue(page, row, { x, y, maxWidth, fonts }) {
  const { regularFont } = fonts;
  const items = Array.isArray(row?.value?.items) ? row.value.items : [];
  const fontSize = 10;
  const swatchRadius = 3.5;
  const swatchGap = 5;
  const itemGap = 10;
  const lineHeight = 12;
  let cursorX = x;
  let cursorY = y;

  for (const item of items) {
    const label = String(item?.label || "").trim();
    if (!label) {
      continue;
    }

    const labelWidth = regularFont.widthOfTextAtSize(label, fontSize);
    const itemWidth = (swatchRadius * 2) + swatchGap + labelWidth;
    if (cursorX > x && cursorX + itemWidth > x + maxWidth) {
      cursorX = x;
      cursorY -= lineHeight;
    }

    const [fillR, fillG, fillB] = getPdfColorSwatchFill(item.key);
    page.drawCircle({
      x: cursorX + swatchRadius,
      y: cursorY + 2,
      size: swatchRadius,
      color: rgb(fillR, fillG, fillB),
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.6
    });
    page.drawText(label, {
      x: cursorX + (swatchRadius * 2) + swatchGap,
      y: cursorY - 2,
      font: regularFont,
      size: fontSize,
      color: rgb(0.12, 0.16, 0.2)
    });
    cursorX += itemWidth + itemGap;
  }
}

export function drawDetailGroup(page, group, { startX, startY, width, fonts }) {
  const { regularFont, boldFont } = fonts;
  const columnGap = 12;
  const contentWidth = width - BOX_PADDING * 2;
  const columnWidth = (contentWidth - columnGap) / 2;
  const rowLabelSize = 8;
  const rowValueSize = 10;
  const rowLabelLineHeight = 10;
  const rowValueLineHeight = 12;

  const rows = group.items.map((row) => {
    const labelHeight = measureTextBlockHeight(row.label, {
      font: boldFont,
      size: rowLabelSize,
      lineHeight: rowLabelLineHeight,
      width: columnWidth,
      maxLines: 2
    });
    const valueHeight = measureTextBlockHeight(getRowText(row), {
      font: regularFont,
      size: rowValueSize,
      lineHeight: rowValueLineHeight,
      width: columnWidth,
      maxLines: 4
    });
    return {
      ...row,
      height: labelHeight + valueHeight + 7
    };
  });

  const columnHeights = [0, 0];
  const positionedRows = rows.map((row) => {
    const targetColumn = columnHeights[0] <= columnHeights[1] ? 0 : 1;
    const offsetY = columnHeights[targetColumn];
    columnHeights[targetColumn] += row.height + 6;
    return {
      ...row,
      column: targetColumn,
      offsetY
    };
  });

  const boxHeight = Math.max(columnHeights[0], columnHeights[1]) + BOX_PADDING * 2 - 6;
  drawRoundedRect(page, {
    x: startX,
    y: startY - boxHeight,
    width,
    height: boxHeight,
    radius: BLOCK_RADIUS,
    color: SUBTLE_BLOCK_COLOR
  });

  for (const row of positionedRows) {
    const rowX = startX + BOX_PADDING + (row.column * (columnWidth + columnGap));
    let rowY = startY - BOX_PADDING - row.offsetY - rowLabelLineHeight;
    rowY = drawTextBlock(page, row.label, {
      x: rowX,
      y: rowY,
      width: columnWidth,
      font: boldFont,
      size: rowLabelSize,
      lineHeight: rowLabelLineHeight,
      color: rgb(0.43, 0.48, 0.53),
      maxLines: 2
    });
    if (row?.value?.kind === "colors") {
      drawColorValue(page, row, { x: rowX, y: rowY - 2, maxWidth: columnWidth, fonts });
    } else {
      drawTextBlock(page, getRowText(row), {
        x: rowX,
        y: rowY - 4,
        width: columnWidth,
        font: regularFont,
        size: rowValueSize,
        lineHeight: rowValueLineHeight,
        color: rgb(0.12, 0.16, 0.2),
        maxLines: 4
      });
    }
  }

  return startY - boxHeight - 8;
}
