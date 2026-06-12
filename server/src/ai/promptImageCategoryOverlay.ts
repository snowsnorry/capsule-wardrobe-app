import type {
  PromptImageDownloadResult,
  PromptImageItemLike,
} from "./types.js";
import {
  BACKGROUND_COLOR,
  BORDER_WIDTH,
  escapeXml,
  GRID_COLOR,
  GRID_COLUMNS,
  GRID_HEIGHT,
  GRID_ROWS,
  GRID_WIDTH,
  HEADER_FONT_SIZE,
  HEADER_HEIGHT,
  LABEL_BACKGROUND_COLOR,
  TILE_LABEL_BACKGROUND_HEIGHT,
  TILE_LABEL_BACKGROUND_MIN_WIDTH,
  TILE_LABEL_BACKGROUND_PADDING_X,
  TILE_LABEL_FONT_SIZE,
  TILE_SIZE,
} from "./promptImagesShared.js";

type CategoryOverlayOptions = {
  gridHeight?: number;
  gridRows?: number;
};

export function createCategoryOverlaySvg(
  category: string,
  entries: Array<{
    item: PromptImageItemLike;
    result: PromptImageDownloadResult;
    slotIndex: number;
  }>,
  options: CategoryOverlayOptions = {},
) {
  const width = GRID_WIDTH;
  const gridHeight = options.gridHeight ?? GRID_HEIGHT;
  const gridRows = options.gridRows ?? GRID_ROWS;
  const height = HEADER_HEIGHT + gridHeight;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<rect x="0" y="0" width="${width}" height="${HEADER_HEIGHT}" fill="${BACKGROUND_COLOR}"/>`,
    `<text x="${width / 2}" y="${Math.round(HEADER_HEIGHT / 2)}" text-anchor="middle" dominant-baseline="middle" fill="${GRID_COLOR}" font-size="${HEADER_FONT_SIZE}" font-family="Arial, Helvetica, sans-serif" font-weight="700">Category: ${escapeXml(category)}</text>`,
    `<rect x="${BORDER_WIDTH / 2}" y="${HEADER_HEIGHT + BORDER_WIDTH / 2}" width="${GRID_WIDTH - BORDER_WIDTH}" height="${gridHeight - BORDER_WIDTH}" fill="none" stroke="${GRID_COLOR}" stroke-width="${BORDER_WIDTH}"/>`,
  ];

  addCategoryGridLines(parts, { gridHeight, gridRows });
  addCategoryItemLabels(parts, entries);

  parts.push("</svg>");
  return Buffer.from(parts.join(""));
}

function addCategoryGridLines(
  parts: string[],
  { gridHeight, gridRows }: Required<CategoryOverlayOptions>,
) {
  for (let column = 1; column < GRID_COLUMNS; column += 1) {
    const x = column * TILE_SIZE;
    parts.push(
      `<line x1="${x}" y1="${HEADER_HEIGHT}" x2="${x}" y2="${HEADER_HEIGHT + gridHeight}" stroke="${GRID_COLOR}" stroke-width="${BORDER_WIDTH}"/>`,
    );
  }

  for (let row = 1; row < gridRows; row += 1) {
    const y = HEADER_HEIGHT + row * TILE_SIZE;
    parts.push(
      `<line x1="0" y1="${y}" x2="${GRID_WIDTH}" y2="${y}" stroke="${GRID_COLOR}" stroke-width="${BORDER_WIDTH}"/>`,
    );
  }
}

function addCategoryItemLabels(
  parts: string[],
  entries: Array<{
    item: PromptImageItemLike;
    result: PromptImageDownloadResult;
    slotIndex: number;
  }>,
) {
  for (const entry of entries) {
    const label = escapeXml(String(entry.item?.id ?? ""));
    if (!label) {
      continue;
    }

    parts.push(buildCategoryItemLabel(entry, label));
  }
}

function buildCategoryItemLabel(
  entry: { item: PromptImageItemLike; slotIndex: number },
  label: string,
) {
  const row = Math.floor(entry.slotIndex / GRID_COLUMNS);
  const column = entry.slotIndex % GRID_COLUMNS;
  const x = column * TILE_SIZE + 16;
  const y = HEADER_HEIGHT + row * TILE_SIZE + 36;
  const approximateLabelWidth = Math.max(
    TILE_LABEL_BACKGROUND_MIN_WIDTH,
    Math.round(
      String(entry.item?.id ?? "").length * (TILE_LABEL_FONT_SIZE * 0.64) +
        TILE_LABEL_BACKGROUND_PADDING_X * 2,
    ),
  );

  return [
    `<rect x="${x - TILE_LABEL_BACKGROUND_PADDING_X}" y="${y - TILE_LABEL_BACKGROUND_HEIGHT + 4}" width="${approximateLabelWidth}" height="${TILE_LABEL_BACKGROUND_HEIGHT}" rx="6" ry="6" fill="${LABEL_BACKGROUND_COLOR}" fill-opacity="0.94"/>`,
    `<text x="${x}" y="${y}" fill="${GRID_COLOR}" font-size="${TILE_LABEL_FONT_SIZE}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${label}</text>`,
  ].join("");
}
