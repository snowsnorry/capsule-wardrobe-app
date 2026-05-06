import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";
import type {
  PromptDebugImageCategory,
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimings
} from "./types.js";
import {
  CATEGORY_COLLAGE_JPEG_QUALITY,
  addTiming,
  buildPromptTileCompositeInput,
  createPromptImageTimings,
  ensureCleanDirectory,
  getErrorMessage,
  mapWithConcurrency,
  nowMs,
  sanitizeFileName,
  escapeXml,
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
  BACKGROUND_COLOR,
  BORDER_WIDTH,
  GRID_COLOR,
  groupPromptImageItemsByCategory,
  type PromptDebugImageCategoryWithFile
} from "./promptImagesShared.js";
import { downloadPromptImageAsset } from "./promptImageDownloads.js";
import { logWarn } from "../logger.js";
import {
  saveDebugArtifacts,
  stitchCategoryImagesVertically,
  stripCategoryBuffer
} from "./promptImageArtifacts.js";

function createCategoryOverlaySvg(
  category: string,
  entries: Array<{ item: PromptImageItemLike; result: PromptImageDownloadResult; slotIndex: number }>
) {
  const width = GRID_WIDTH;
  const height = HEADER_HEIGHT + GRID_HEIGHT;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<rect x="0" y="0" width="${width}" height="${HEADER_HEIGHT}" fill="${BACKGROUND_COLOR}"/>`,
    `<text x="${width / 2}" y="${Math.round(HEADER_HEIGHT / 2)}" text-anchor="middle" dominant-baseline="middle" fill="${GRID_COLOR}" font-size="${HEADER_FONT_SIZE}" font-family="Arial, Helvetica, sans-serif" font-weight="700">Category: ${escapeXml(category)}</text>`,
    `<rect x="${BORDER_WIDTH / 2}" y="${HEADER_HEIGHT + BORDER_WIDTH / 2}" width="${GRID_WIDTH - BORDER_WIDTH}" height="${GRID_HEIGHT - BORDER_WIDTH}" fill="none" stroke="${GRID_COLOR}" stroke-width="${BORDER_WIDTH}"/>`
  ];

  for (let column = 1; column < GRID_COLUMNS; column += 1) {
    const x = column * TILE_SIZE;
    parts.push(
      `<line x1="${x}" y1="${HEADER_HEIGHT}" x2="${x}" y2="${HEADER_HEIGHT + GRID_HEIGHT}" stroke="${GRID_COLOR}" stroke-width="${BORDER_WIDTH}"/>`
    );
  }

  for (let row = 1; row < GRID_ROWS; row += 1) {
    const y = HEADER_HEIGHT + row * TILE_SIZE;
    parts.push(
      `<line x1="0" y1="${y}" x2="${GRID_WIDTH}" y2="${y}" stroke="${GRID_COLOR}" stroke-width="${BORDER_WIDTH}"/>`
    );
  }

  for (const entry of entries) {
    const label = escapeXml(String(entry.item?.id ?? ""));
    if (!label) {
      continue;
    }

    const row = Math.floor(entry.slotIndex / GRID_COLUMNS);
    const column = entry.slotIndex % GRID_COLUMNS;
    const x = column * TILE_SIZE + 16;
    const y = HEADER_HEIGHT + row * TILE_SIZE + 36;
    const approximateLabelWidth = Math.max(
      TILE_LABEL_BACKGROUND_MIN_WIDTH,
      Math.round(String(entry.item?.id ?? "").length * (TILE_LABEL_FONT_SIZE * 0.64) + TILE_LABEL_BACKGROUND_PADDING_X * 2)
    );

    parts.push(
      `<rect x="${x - TILE_LABEL_BACKGROUND_PADDING_X}" y="${y - TILE_LABEL_BACKGROUND_HEIGHT + 4}" width="${approximateLabelWidth}" height="${TILE_LABEL_BACKGROUND_HEIGHT}" rx="6" ry="6" fill="${LABEL_BACKGROUND_COLOR}" fill-opacity="0.94"/>`,
      `<text x="${x}" y="${y}" fill="${GRID_COLOR}" font-size="${TILE_LABEL_FONT_SIZE}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${label}</text>`
    );
  }

  parts.push("</svg>");
  return Buffer.from(parts.join(""));
}

async function buildCategoryImage({
  category,
  entries,
  timings = null
}: {
  category: string;
  entries: Array<{ item: PromptImageItemLike; result: PromptImageDownloadResult; slotIndex: number }>;
  timings?: PromptImageTimings | null;
}): Promise<{ buffer: Buffer; mimeType: string; manifestEntries: NonNullable<PromptDebugImageCategory["items"]> }> {
  const composites = [];
  const manifestEntries: NonNullable<PromptDebugImageCategory["items"]> = [];

  for (const [slotIndex, entry] of entries.entries()) {
    const row = Math.floor(slotIndex / GRID_COLUMNS);
    const column = slotIndex % GRID_COLUMNS;
    const left = column * TILE_SIZE;
    const top = HEADER_HEIGHT + row * TILE_SIZE;

    if (entry.result.buffer) {
      try {
        const tileStartedAt = nowMs();
        const tile = await buildPromptTileCompositeInput(entry.result.buffer, {
          autoRotate: entry.result.source !== "cache"
        });
        addTiming(timings, "tileBuildMs", tileStartedAt);
        composites.push({
          input: tile.input,
          raw: tile.raw,
          left,
          top
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : getErrorMessage(error, "tile_build_failed");

        logWarn(
          "[prompt-images][tile-build-failed]",
          JSON.stringify({
            id: entry.result.id,
            category,
            imageUrl: entry.result.imageUrl,
            reason
          })
        );

        entry.result.status = "skipped";
        entry.result.reason = reason;
      }
    }

    manifestEntries.push({
      slotIndex,
      id: entry.result.id,
      source: entry.result.source,
      imageUrl: entry.result.imageUrl,
      originalImageUrl: entry.result.originalImageUrl,
      status: entry.result.status,
      reason: entry.result.reason
    });
  }

  const overlaySvg = createCategoryOverlaySvg(category, entries);

  const collageStartedAt = nowMs();
  const buffer = await sharp({
    create: {
      width: GRID_WIDTH,
      height: HEADER_HEIGHT + GRID_HEIGHT,
      channels: 3,
      background: BACKGROUND_COLOR
    }
  })
    .composite([
      ...composites,
      { input: overlaySvg, left: 0, top: 0 }
    ])
    .jpeg({
      quality: CATEGORY_COLLAGE_JPEG_QUALITY,
      mozjpeg: false,
      progressive: false
    })
    .toBuffer();
  addTiming(timings, "collageEncodeMs", collageStartedAt);

  return {
    buffer,
    mimeType: "image/jpeg",
    manifestEntries
  };
}

async function createIntermediateCollageDirectory({
  debugOutputDir = null,
  saveDebugArtifacts = false
}: {
  debugOutputDir?: string | URL | null;
  saveDebugArtifacts?: boolean;
} = {}): Promise<{ directory: string; shouldCleanup: boolean }> {
  if (saveDebugArtifacts) {
    if (!debugOutputDir) {
      throw new Error("debugOutputDir is required when saveDebugArtifacts is enabled");
    }

    const resolvedOutputDir = debugOutputDir instanceof URL
      ? fileURLToPath(debugOutputDir)
      : path.resolve(String(debugOutputDir));

    await ensureCleanDirectory(resolvedOutputDir);

    return {
      directory: resolvedOutputDir,
      shouldCleanup: false
    };
  }

  return {
    directory: await mkdtemp(path.join(os.tmpdir(), "prompt-images-")),
    shouldCleanup: true
  };
}

async function buildPromptDebugImages({
  normalizedItems = [],
  debugOutputDir = null,
  saveDebugArtifacts: shouldSaveDebugArtifacts = false
}: {
  normalizedItems?: PromptImageItemLike[];
  debugOutputDir?: string | URL | null;
  saveDebugArtifacts?: boolean;
} = {}) {
  const groupedItems = groupPromptImageItemsByCategory(normalizedItems);
  const categories: PromptDebugImageCategoryWithFile[] = [];
  let cachedCount = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  const timings = createPromptImageTimings();
  const { directory: collageDirectory, shouldCleanup } = await createIntermediateCollageDirectory({
    debugOutputDir,
    saveDebugArtifacts: shouldSaveDebugArtifacts
  });

  try {
    for (const [category, items] of groupedItems.entries()) {
      const categoryResult = await buildPromptDebugImagesForCategory({
        category,
        items,
        downloadConcurrency: IMAGE_DOWNLOAD_CONCURRENCY,
        timings
      });
      const categoryFile = path.join(collageDirectory, categoryResult.category.filename);
      await writeFile(categoryFile, categoryResult.category.buffer);
      categories.push({
        ...stripCategoryBuffer(categoryResult.category),
        file: categoryFile
      });
      cachedCount += categoryResult.cachedCount;
      downloadedCount += categoryResult.downloadedCount;
      skippedCount += categoryResult.skippedCount;
      categoryResult.category.buffer = null;
    }

    const stitched = await stitchCategoryImagesVertically(categories);

    if (shouldSaveDebugArtifacts) {
      try {
        const debugSaveStartedAt = nowMs();
        await saveDebugArtifacts({
          categories,
          stitched,
          cachedCount,
          downloadedCount,
          skippedCount,
          debugOutputDir
        });
        addTiming(timings, "debugSaveMs", debugSaveStartedAt);
      } catch (error) {
        logWarn("[prompt-images][debug-save-failed]", JSON.stringify({ message: getErrorMessage(error) }));
      }
    }

    return {
      categories: categories.map(stripCategoryBuffer),
      stitched,
      cachedCount,
      downloadedCount,
      skippedCount,
      timings
    };
  } finally {
    if (shouldCleanup) {
      await rm(collageDirectory, { recursive: true, force: true });
    }
  }
}

async function buildPromptDebugImagesForCategory({
  category = "",
  items = [],
  downloadConcurrency = IMAGE_DOWNLOAD_CONCURRENCY,
  timings = null
}: {
  category?: string;
  items?: PromptImageItemLike[];
  downloadConcurrency?: number;
  timings?: PromptImageTimings | null;
} = {}): Promise<{
  category: PromptDebugImageCategory;
  cachedCount: number;
  downloadedCount: number;
  skippedCount: number;
}> {
  const categoryStartedAt = nowMs();
  const categorySlug = sanitizeFileName(category);
  const downloadResults = await mapWithConcurrency(
    items,
    downloadConcurrency,
    (item) => downloadPromptImageAsset(item, timings)
  );

  let cachedCount = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  for (const result of downloadResults) {
    if (result.status === "downloaded") {
      if (result.source === "cache") {
        cachedCount += 1;
      } else {
        downloadedCount += 1;
      }
    } else {
      skippedCount += 1;
    }
  }

  const entries = items.map((item, slotIndex) => ({
    item,
    result: downloadResults[slotIndex],
    slotIndex
  }));

  const { buffer, mimeType, manifestEntries } = await buildCategoryImage({
    category,
    entries,
    timings
  });
  addTiming(timings, "categoryBuildMs", categoryStartedAt);

  return {
    category: {
      category,
      mimeType,
      buffer,
      filename: `category-${categorySlug}.jpg`,
      totalItems: items.length,
      cachedCount,
      downloadedCount,
      skippedCount,
      items: manifestEntries
    },
    cachedCount,
    downloadedCount,
    skippedCount
  };
}

export {
  buildCategoryImage,
  buildPromptDebugImages,
  buildPromptDebugImagesForCategory,
  createCategoryOverlaySvg,
  createIntermediateCollageDirectory,
};
