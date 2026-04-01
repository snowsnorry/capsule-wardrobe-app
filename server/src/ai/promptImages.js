import { createHash } from "node:crypto";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fork as nodeFork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";
import { getSafeServerFetchUrl } from "../serverUrlSecurity.js";

const TILE_SIZE = 320;
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
const PROMPT_IMAGES_CHILD_TIMEOUT_MS = Number.parseInt(process.env.PROMPT_IMAGES_CHILD_TIMEOUT_MS || "", 10) || 120000;
const PROMPT_IMAGES_CHILD_PATH = new URL("./promptImages.child.js", import.meta.url);
const PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY || "", 10) || 5;
const STORAGE_IMAGES_DIR = fileURLToPath(new URL("../../../storage/images/", import.meta.url));

function nowMs() {
  return Date.now();
}

function createPromptImageTimings() {
  return {
    cacheLookupMs: 0,
    networkFetchMs: 0,
    sourceInspectMs: 0,
    tileBuildMs: 0,
    collageEncodeMs: 0,
    debugSaveMs: 0,
    categoryBuildMs: 0,
    childRoundTripMs: 0
  };
}

function addTiming(timings, key, startedAt) {
  if (!timings || !key || !Number.isFinite(startedAt)) {
    return;
  }

  timings[key] = (Number(timings[key]) || 0) + Math.max(0, nowMs() - startedAt);
}

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

  return getSafeServerFetchUrl(trimmed.replaceAll("{width}", String(REQUEST_IMAGE_WIDTH)));
}

function getOriginalImageUrl(imageUrl) {
  return String(imageUrl ?? "").trim();
}

function buildLocalImageCachePath(originalImageUrl) {
  const digest = createHash("sha256")
    .update(String(originalImageUrl || ""), "utf8")
    .digest("hex");
  return path.join(STORAGE_IMAGES_DIR, `${digest}.jpg`);
}

async function readImageFromLocalCache(imageUrl) {
  const originalImageUrl = getOriginalImageUrl(imageUrl);
  if (!originalImageUrl) {
    return null;
  }

  const cachePath = buildLocalImageCachePath(originalImageUrl);

  try {
    const buffer = await readFile(cachePath);
    return {
      buffer,
      mimeType: "image/jpeg",
      originalImageUrl,
      cachePath
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function createSharpPipeline(buffer, { autoRotate = true } = {}) {
  const pipeline = sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_SOURCE_IMAGE_PIXELS
  });

  if (autoRotate) {
    pipeline.rotate();
  }

  return pipeline;
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

async function buildPromptTileCompositeInput(buffer, { autoRotate = true } = {}) {
  const { data, info } = await createSharpPipeline(buffer, { autoRotate })
    .resize(TILE_SIZE, TILE_SIZE, {
      fit: "contain",
      withoutEnlargement: true,
      background: BACKGROUND_COLOR,
      fastShrinkOnLoad: true
    })
    .flatten({ background: BACKGROUND_COLOR })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    input: data,
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  };
}

async function downloadProductImageAsset(item) {
  const id = String(item?.id ?? "");
  const originalImageUrl = getOriginalImageUrl(item?.image_url);
  const imageUrl = resolveSourceImageUrl(item?.image_url);

  if (!imageUrl) {
    return {
      id,
      category: item?.category ?? "",
      source: null,
      imageUrl,
      originalImageUrl,
      status: "skipped",
      reason: "missing_image_url",
      mimeType: null,
      buffer: null,
      width: null,
      height: null
    };
  }

  try {
    const cachedImage = await readImageFromLocalCache(item?.image_url);
    if (cachedImage?.buffer) {
      const metadata = await sharp(cachedImage.buffer).metadata().catch(() => ({}));
      return {
        id,
        category: item?.category ?? "",
        source: "cache",
        imageUrl,
        originalImageUrl,
        cachePath: cachedImage.cachePath,
        status: "downloaded",
        reason: null,
        mimeType: cachedImage.mimeType,
        buffer: cachedImage.buffer,
        originalMimeType: cachedImage.mimeType,
        width: Number(metadata?.width) || null,
        height: Number(metadata?.height) || null
      };
    }

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
      source: "download",
      imageUrl,
      originalImageUrl,
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
      source: null,
      imageUrl,
      originalImageUrl,
      status: "skipped",
      reason,
      mimeType: null,
      buffer: null,
      width: null,
      height: null
    };
  }
}

async function downloadPromptImageAsset(item, timings = null) {
  const id = String(item?.id ?? "");
  const originalImageUrl = getOriginalImageUrl(item?.image_url);
  const imageUrl = resolveSourceImageUrl(item?.image_url);

  if (!imageUrl) {
    return {
      id,
      category: item?.category ?? "",
      source: null,
      imageUrl,
      originalImageUrl,
      status: "skipped",
      reason: "missing_image_url",
      mimeType: null,
      buffer: null,
      width: null,
      height: null
    };
  }

  try {
    const cacheLookupStartedAt = nowMs();
    const cachedImage = await readImageFromLocalCache(item?.image_url);
    addTiming(timings, "cacheLookupMs", cacheLookupStartedAt);
    if (cachedImage?.buffer) {
      const inspectStartedAt = nowMs();
      const metadata = await sharp(cachedImage.buffer).metadata().catch(() => ({}));
      addTiming(timings, "sourceInspectMs", inspectStartedAt);
      return {
        id,
        category: item?.category ?? "",
        source: "cache",
        imageUrl,
        originalImageUrl,
        cachePath: cachedImage.cachePath,
        status: "downloaded",
        reason: null,
        mimeType: cachedImage.mimeType,
        buffer: cachedImage.buffer,
        width: Number(metadata?.width) || null,
        height: Number(metadata?.height) || null
      };
    }

    const fetchStartedAt = nowMs();
    const response = await fetch(imageUrl, {
      signal: getRequestSignal()
    });
    addTiming(timings, "networkFetchMs", fetchStartedAt);

    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const inspectStartedAt = nowMs();
    const metadata = await sharp(sourceBuffer, {
      failOn: "none",
      limitInputPixels: MAX_SOURCE_IMAGE_PIXELS
    }).metadata().catch(() => ({}));
    addTiming(timings, "sourceInspectMs", inspectStartedAt);

    return {
      id,
      category: item?.category ?? "",
      source: "download",
      imageUrl,
      originalImageUrl,
      status: "downloaded",
      reason: null,
      mimeType: String(response.headers.get("content-type") || "").toLowerCase() || "application/octet-stream",
      buffer: sourceBuffer,
      width: Number(metadata?.width) || null,
      height: Number(metadata?.height) || null
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
      source: null,
      imageUrl,
      originalImageUrl,
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
        source: result.source,
        imageUrl: result.imageUrl,
        originalImageUrl: result.originalImageUrl,
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
  entries,
  timings = null
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

async function saveDebugArtifacts({ categories, cachedCount, downloadedCount, skippedCount, debugOutputDir }) {
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
      cachedCount: categoryEntry.cachedCount,
      downloadedCount: categoryEntry.downloadedCount,
      skippedCount: categoryEntry.skippedCount,
      items: categoryEntry.items
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDir: resolvedOutputDir,
    cachedCount,
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
  let cachedCount = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  const timings = createPromptImageTimings();

  for (const [category, items] of groupedItems.entries()) {
    const categoryResult = await buildPromptDebugImagesForCategory({
      category,
      items,
      downloadConcurrency: IMAGE_DOWNLOAD_CONCURRENCY,
      timings
    });
    categories.push(categoryResult.category);
    cachedCount += categoryResult.cachedCount;
    downloadedCount += categoryResult.downloadedCount;
    skippedCount += categoryResult.skippedCount;
  }

  if (shouldSaveDebugArtifacts) {
    try {
      const debugSaveStartedAt = nowMs();
      await saveDebugArtifacts({
        categories,
        cachedCount,
        downloadedCount,
        skippedCount,
        debugOutputDir
      });
      addTiming(timings, "debugSaveMs", debugSaveStartedAt);
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
    cachedCount,
    downloadedCount,
    skippedCount,
    timings
  };
}

async function buildPromptDebugImagesForCategory({
  category = "",
  items = [],
  downloadConcurrency = IMAGE_DOWNLOAD_CONCURRENCY,
  timings = null
} = {}) {
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

function serializePromptDebugImagesForIpc(result = {}) {
  return {
    cachedCount: Number(result?.cachedCount) || 0,
    downloadedCount: Number(result?.downloadedCount) || 0,
    skippedCount: Number(result?.skippedCount) || 0,
    timings: result?.timings && typeof result.timings === "object" ? result.timings : undefined,
    categories: Array.isArray(result?.categories)
      ? result.categories.map((category) => ({
        category: category?.category ?? "",
        mimeType: category?.mimeType ?? "image/jpeg",
        filename: category?.filename ?? "",
        totalItems: Number(category?.totalItems) || 0,
        cachedCount: Number(category?.cachedCount) || 0,
        downloadedCount: Number(category?.downloadedCount) || 0,
        skippedCount: Number(category?.skippedCount) || 0,
        items: Array.isArray(category?.items) ? category.items : [],
        buffer: Buffer.isBuffer(category?.buffer)
          ? category.buffer
          : category?.buffer instanceof Uint8Array
            ? Buffer.from(category.buffer)
            : null
      }))
      : []
  };
}

function normalizeIpcBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (
    value
    && typeof value === "object"
    && value.type === "Buffer"
    && Array.isArray(value.data)
  ) {
    return Buffer.from(value.data);
  }

  return null;
}

function deserializePromptDebugImagesFromIpc(payload = {}) {
  return {
    cachedCount: Number(payload?.cachedCount) || 0,
    downloadedCount: Number(payload?.downloadedCount) || 0,
    skippedCount: Number(payload?.skippedCount) || 0,
    timings: {
      ...createPromptImageTimings(),
      ...(payload?.timings && typeof payload.timings === "object" ? payload.timings : {})
    },
    categories: Array.isArray(payload?.categories)
      ? payload.categories.map((category) => ({
        category: category?.category ?? "",
        mimeType: category?.mimeType ?? "image/jpeg",
        filename: category?.filename ?? "",
        totalItems: Number(category?.totalItems) || 0,
        cachedCount: Number(category?.cachedCount) || 0,
        downloadedCount: Number(category?.downloadedCount) || 0,
        skippedCount: Number(category?.skippedCount) || 0,
        items: Array.isArray(category?.items) ? category.items : [],
        buffer: normalizeIpcBuffer(category?.buffer)
          || (
            typeof category?.bufferBase64 === "string" && category.bufferBase64.length > 0
              ? Buffer.from(category.bufferBase64, "base64")
              : null
          )
      }))
      : []
  };
}

function isValidPromptImagesIpcPayload(message) {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (!Array.isArray(message.categories)) {
    return false;
  }

  return message.categories.every((category) => (
    normalizeIpcBuffer(category?.buffer) !== null
    || typeof category?.bufferBase64 === "string"
  ));
}

async function buildPromptDebugImagesInChild({
  normalizedItems = [],
  debugOutputDir = null,
  saveDebugArtifacts: shouldSaveDebugArtifacts = false,
  forkImpl = nodeFork
} = {}) {
  const childRoundTripStartedAt = nowMs();
  const result = await buildPromptDebugImagesAllInChild({
    normalizedItems,
    forkImpl
  });
  result.timings = {
    ...createPromptImageTimings(),
    ...(result.timings && typeof result.timings === "object" ? result.timings : {})
  };
  addTiming(result.timings, "childRoundTripMs", childRoundTripStartedAt);

  if (shouldSaveDebugArtifacts) {
    try {
      const debugSaveStartedAt = nowMs();
      await saveDebugArtifacts({
        categories: result.categories,
        cachedCount: result.cachedCount,
        downloadedCount: result.downloadedCount,
        skippedCount: result.skippedCount,
        debugOutputDir
      });
      addTiming(result.timings, "debugSaveMs", debugSaveStartedAt);
    } catch (error) {
      console.warn(
        "[prompt-images][debug-save-failed]",
        JSON.stringify({
          message: error?.message || "unknown_error"
        })
      );
    }
  }

  return result;
}

async function buildPromptDebugImagesAllInChild({
  normalizedItems = [],
  forkImpl = nodeFork
} = {}) {
  return new Promise((resolve, reject) => {
    const child = forkImpl(fileURLToPath(PROMPT_IMAGES_CHILD_PATH), {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: []
    });
    let settled = false;
    let childExited = false;

    const timeout = setTimeout(() => {
      cleanup();
      child.kill();
      reject(new Error("prompt_images_child_timeout"));
    }, PROMPT_IMAGES_CHILD_TIMEOUT_MS);
    timeout.unref?.();

    function cleanup() {
      clearTimeout(timeout);
      child.removeListener("message", onMessage);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
    }

    function resolveOnce(value) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    }

    function rejectOnce(error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    }

    function onMessage(message) {
      if (message?.ok === true) {
        if (!isValidPromptImagesIpcPayload(message)) {
          rejectOnce(new Error("prompt_images_child_invalid_payload"));
          return;
        }

        resolveOnce(deserializePromptDebugImagesFromIpc(message));
        return;
      }

      if (message?.ok === false) {
        const error = new Error(String(message?.message || "prompt_images_child_failed"));
        if (typeof message?.stack === "string" && message.stack.trim().length > 0) {
          error.stack = message.stack;
        }
        rejectOnce(error);
      }
    }

    function onError(error) {
      rejectOnce(error);
    }

    function onExit(code, signal) {
      childExited = true;
      if (!settled) {
        rejectOnce(new Error(`prompt_images_child_exit:${code ?? "null"}:${signal ?? "null"}`));
      }
    }

    child.on("message", onMessage);
    child.on("error", onError);
    child.on("exit", onExit);

    child.send({
      normalizedItems,
      downloadConcurrency: PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY
    }, (error) => {
      if (error && !childExited) {
        rejectOnce(error);
      }
    });
  });
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
  buildLocalImageCachePath,
  getOriginalImageUrl,
  downloadProductImageAssets,
  groupPromptImageItemsByCategory,
  buildPromptDebugImages,
  buildPromptDebugImagesForCategory,
  buildPromptDebugImagesInChild,
  preparePdfImageAsset,
  preparePdfImageAssets,
  readImageFromLocalCache,
  resolveSourceImageUrl,
  serializePromptDebugImagesForIpc,
  deserializePromptDebugImagesFromIpc
};
