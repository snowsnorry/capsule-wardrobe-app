import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";

const TILE_SIZE = 400;
const GRID_COLUMNS = 5;
const GRID_ROWS = 2;
const MAX_ITEMS_PER_CATEGORY = GRID_COLUMNS * GRID_ROWS;
const GRID_WIDTH = TILE_SIZE * GRID_COLUMNS;
const GRID_HEIGHT = TILE_SIZE * GRID_ROWS;
const HEADER_HEIGHT = 120;
const BORDER_WIDTH = 8;
const GRID_COLOR = "#d10f0f";
const BACKGROUND_COLOR = "#E4E7EA";
const TILE_LABEL_FONT_SIZE = 28;
const HEADER_FONT_SIZE = 42;
const REQUEST_TIMEOUT_MS = 15000;
const CATEGORY_COLLAGE_JPEG_QUALITY = 80;
const NORMALIZED_IMAGE_JPEG_QUALITY = 80;
const PDF_IMAGE_JPEG_QUALITY = 76;
const MAX_SOURCE_IMAGE_PIXELS = Number.parseInt(process.env.MAX_SOURCE_IMAGE_PIXELS || "", 10) || 16000000;
const REQUEST_IMAGE_WIDTH = Number.parseInt(process.env.PROMPT_IMAGE_REQUEST_WIDTH || "", 10) || 1000;

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizeFileName(value) {
  const sanitized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "unknown";
}

function groupPromptImageItemsByCategory(normalizedItems = []) {
  const groups = new Map();

  for (const item of normalizedItems) {
    const category = String(item?.category || "").trim();
    if (!category) {
      continue;
    }

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    const group = groups.get(category);
    if (group.length >= MAX_ITEMS_PER_CATEGORY) {
      continue;
    }

    group.push(item);
  }

  return groups;
}

async function ensureCleanDirectory(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker())
  );

  return results;
}

function getRequestSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  return undefined;
}

function resolveSourceImageUrl(imageUrl) {
  const trimmed = String(imageUrl ?? "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replaceAll("{width}", String(REQUEST_IMAGE_WIDTH));
}

function createSharpPipeline(buffer) {
  return sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_SOURCE_IMAGE_PIXELS
  }).rotate();
}

async function normalizeDownloadedImage(buffer) {
  const pipeline = createSharpPipeline(buffer);
  const metadata = await pipeline.metadata().catch(() => ({}));
  const normalizedBuffer = await pipeline
    .flatten({ background: BACKGROUND_COLOR })
    .jpeg({
      quality: NORMALIZED_IMAGE_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true
    })
    .toBuffer();

  return {
    buffer: normalizedBuffer,
    mimeType: "image/jpeg",
    width: Number(metadata?.width) || null,
    height: Number(metadata?.height) || null
  };
}

async function downloadProductImageAsset(item) {
  const id = String(item?.id ?? "");
  const imageUrl = resolveSourceImageUrl(item?.image_url);

  if (!imageUrl) {
    return {
      id,
      category: item?.category ?? "",
      imageUrl,
      status: "skipped",
      reason: "missing_image_url",
      mimeType: null,
      buffer: null,
      width: null,
      height: null
    };
  }

  try {
    const response = await fetch(imageUrl, {
      signal: getRequestSignal()
    });

    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    const mimeType = String(response.headers.get("content-type") || "").toLowerCase() || "application/octet-stream";
    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const normalized = await normalizeDownloadedImage(sourceBuffer);

    return {
      id,
      category: item?.category ?? "",
      imageUrl,
      status: "downloaded",
      reason: null,
      mimeType: normalized.mimeType,
      buffer: normalized.buffer,
      originalMimeType: mimeType,
      width: normalized.width,
      height: normalized.height
    };
  } catch (error) {
    const reason = error?.name === "TimeoutError"
      ? "timeout"
      : String(error?.message || "download_failed");

    console.warn(
      "[prompt-images][asset-download-failed]",
      JSON.stringify({
        id,
        category: item?.category ?? "",
        imageUrl,
        reason
      })
    );

    return {
      id,
      category: item?.category ?? "",
      imageUrl,
      status: "skipped",
      reason,
      mimeType: null,
      buffer: null,
      width: null,
      height: null
    };
  }
}

async function downloadProductImageAssets(items = []) {
  const downloadResults = await mapWithConcurrency(
    items,
    IMAGE_DOWNLOAD_CONCURRENCY,
    (item) => downloadProductImageAsset(item)
  );

  return Object.fromEntries(
    downloadResults
      .filter((result) => result.status === "downloaded" && result.id && result.buffer)
      .map((result) => [result.id, {
        buffer: result.buffer,
        mimeType: result.mimeType,
        imageUrl: result.imageUrl,
        width: result.width,
        height: result.height
      }])
  );
}

function createCategoryOverlaySvg(category, entries) {
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

    parts.push(
      `<text x="${x}" y="${y}" fill="${GRID_COLOR}" font-size="${TILE_LABEL_FONT_SIZE}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${label}</text>`
    );
  }

  parts.push("</svg>");
  return Buffer.from(parts.join(""));
}

async function buildCategoryImage({
  category,
  entries
}) {
  const composites = [];
  const manifestEntries = [];

  for (const [slotIndex, entry] of entries.entries()) {
    const row = Math.floor(slotIndex / GRID_COLUMNS);
    const column = slotIndex % GRID_COLUMNS;
    const left = column * TILE_SIZE;
    const top = HEADER_HEIGHT + row * TILE_SIZE;

    if (entry.result.buffer) {
      try {
        const tileBuffer = await createSharpPipeline(entry.result.buffer)
          .resize(TILE_SIZE, TILE_SIZE, {
            fit: "contain",
            withoutEnlargement: true,
            background: BACKGROUND_COLOR
          })
          .flatten({ background: BACKGROUND_COLOR })
          .jpeg({
            quality: CATEGORY_COLLAGE_JPEG_QUALITY,
            mozjpeg: true,
            progressive: true
          })
          .toBuffer();

        composites.push({
          input: tileBuffer,
          left,
          top
        });
      } catch (error) {
        const reason = error?.name === "TimeoutError"
          ? "timeout"
          : String(error?.message || "tile_build_failed");

        console.warn(
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
      imageUrl: entry.result.imageUrl,
      status: entry.result.status,
      reason: entry.result.reason
    });
  }

  const overlaySvg = createCategoryOverlaySvg(category, entries);

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
      mozjpeg: true,
      progressive: true
    })
    .toBuffer();

  return {
    buffer,
    mimeType: "image/jpeg",
    manifestEntries
  };
}

async function saveDebugArtifacts({ categories, downloadedCount, skippedCount, debugOutputDir }) {
  if (!debugOutputDir) {
    throw new Error("debugOutputDir is required when saveDebugArtifacts is enabled");
  }

  const resolvedOutputDir = debugOutputDir instanceof URL
    ? fileURLToPath(debugOutputDir)
    : path.resolve(String(debugOutputDir));

  await ensureCleanDirectory(resolvedOutputDir);

  const files = [];
  const manifestCategories = [];

  for (const categoryEntry of categories) {
    const categoryFile = path.join(resolvedOutputDir, categoryEntry.filename);
    await writeFile(categoryFile, categoryEntry.buffer);
    files.push(categoryFile);
    manifestCategories.push({
      category: categoryEntry.category,
      file: categoryFile,
      totalItems: categoryEntry.totalItems,
      downloadedCount: categoryEntry.downloadedCount,
      skippedCount: categoryEntry.skippedCount,
      items: categoryEntry.items
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDir: resolvedOutputDir,
    downloadedCount,
    skippedCount,
    files,
    categories: manifestCategories
  };

  const manifestPath = path.join(resolvedOutputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

async function buildPromptDebugImages({
  normalizedItems = [],
  debugOutputDir = null,
  saveDebugArtifacts: shouldSaveDebugArtifacts = false
}) {

  const groupedItems = groupPromptImageItemsByCategory(normalizedItems);
  const categories = [];
  let downloadedCount = 0;
  let skippedCount = 0;

  for (const [category, items] of groupedItems.entries()) {
    const categorySlug = sanitizeFileName(category);

    const downloadResults = await mapWithConcurrency(
      items,
      IMAGE_DOWNLOAD_CONCURRENCY,
      (item) => downloadProductImageAsset(item)
    );

    for (const result of downloadResults) {
      if (result.status === "downloaded") {
        downloadedCount += 1;
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
      entries
    });

    categories.push({
      category,
      mimeType,
      buffer,
      filename: `category-${categorySlug}.jpg`,
      totalItems: items.length,
      downloadedCount: manifestEntries.filter((entry) => entry.status === "downloaded").length,
      skippedCount: manifestEntries.filter((entry) => entry.status !== "downloaded").length,
      items: manifestEntries
    });
  }

  if (shouldSaveDebugArtifacts) {
    try {
      await saveDebugArtifacts({
        categories,
        downloadedCount,
        skippedCount,
        debugOutputDir
      });
    } catch (error) {
      console.warn(
        "[prompt-images][debug-save-failed]",
        JSON.stringify({
          message: error?.message || "unknown_error"
        })
      );
    }
  }

  return {
    categories,
    downloadedCount,
    skippedCount
  };
}

async function preparePdfImageAsset(imageAsset, { width, height } = {}) {
  if (!imageAsset?.buffer) {
    return null;
  }

  const targetWidth = Math.max(1, Math.round(Number(width) || 1));
  const targetHeight = Math.max(1, Math.round(Number(height) || 1));
  const buffer = await createSharpPipeline(imageAsset.buffer)
    .resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
      background: BACKGROUND_COLOR
    })
    .flatten({ background: BACKGROUND_COLOR })
    .jpeg({
      quality: PDF_IMAGE_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true
    })
    .toBuffer();

  const metadata = await sharp(buffer).metadata().catch(() => ({}));

  return {
    buffer,
    mimeType: "image/jpeg",
    kind: "jpg",
    preparedForPdf: true,
    imageUrl: imageAsset.imageUrl || "",
    width: Number(metadata?.width) || null,
    height: Number(metadata?.height) || null
  };
}

async function preparePdfImageAssets(imageAssetsById = {}, targetSize) {
  const entries = Object.entries(imageAssetsById).filter(([, asset]) => asset?.buffer);
  const preparedEntries = await mapWithConcurrency(entries, IMAGE_DOWNLOAD_CONCURRENCY, async ([id, asset]) => {
    const prepared = await preparePdfImageAsset(asset, targetSize);
    return prepared ? [id, prepared] : null;
  });

  return Object.fromEntries(preparedEntries.filter(Boolean));
}

export {
  TILE_SIZE,
  GRID_COLUMNS,
  GRID_ROWS,
  GRID_WIDTH,
  GRID_HEIGHT,
  HEADER_HEIGHT,
  MAX_ITEMS_PER_CATEGORY,
  downloadProductImageAssets,
  groupPromptImageItemsByCategory,
  buildPromptDebugImages,
  preparePdfImageAsset,
  preparePdfImageAssets
};
