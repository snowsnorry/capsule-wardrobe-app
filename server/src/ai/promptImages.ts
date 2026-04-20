import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { fork as nodeFork } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";
import { getSafeServerFetchUrl } from "../serverUrlSecurity.js";
import type {
  PromptDebugImageCategory,
  PromptDebugImageCategoryManifest,
  PromptDebugImageManifest,
  PromptDebugImageResult,
  PromptDebugImageStitched,
  PromptDebugImageStitchedManifest,
  PromptImageAsset,
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimingKey,
  PromptImageTimings,
  PromptImagesChildMessage,
  PromptImagesChildPayload,
  PromptImagesChildSuccessPayload,
  SerializedIpcBuffer
} from "./types.js";

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
const LABEL_BACKGROUND_COLOR = "#FFFFFF";
const TILE_LABEL_FONT_SIZE = 28;
const TILE_LABEL_BACKGROUND_HEIGHT = 34;
const TILE_LABEL_BACKGROUND_MIN_WIDTH = 54;
const TILE_LABEL_BACKGROUND_PADDING_X = 10;
const HEADER_FONT_SIZE = 42;
const REQUEST_TIMEOUT_MS = 15000;
const CATEGORY_COLLAGE_JPEG_QUALITY = 60;
const NORMALIZED_IMAGE_JPEG_QUALITY = 80;
const PDF_IMAGE_JPEG_QUALITY = 76;
const MAX_SOURCE_IMAGE_PIXELS = Number.parseInt(process.env.MAX_SOURCE_IMAGE_PIXELS || "", 10) || 16000000;
const REQUEST_IMAGE_WIDTH = Number.parseInt(process.env.PROMPT_IMAGE_REQUEST_WIDTH || "", 10) || 1000;
const PROMPT_IMAGES_CHILD_TIMEOUT_MS = Number.parseInt(process.env.PROMPT_IMAGES_CHILD_TIMEOUT_MS || "", 10) || 120000;
const PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY || "", 10) || 5;
const STORAGE_IMAGES_DIR = fileURLToPath(new URL("../../../storage/images/", import.meta.url));
const STITCHED_COLLAGE_FILENAME = "categories-stitched.jpg";

type PromptImagesChildProcessLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => unknown;
  kill: () => unknown;
  send: (message: unknown, callback?: (error: Error | null) => void) => unknown;
};

type PromptImagesFork = (modulePath: string, options?: Record<string, unknown>) => PromptImagesChildProcessLike;
type PromptImageTimingState = PromptImageTimings | Partial<PromptImageTimings> | null | undefined;
type PromptDebugImageCategoryWithFile = PromptDebugImageCategory & { file: string };
type PromptDebugImageCategoryWithoutBuffer = Omit<PromptDebugImageCategory, "buffer" | "bufferBase64" | "file">;
type PromptDebugImageCategoryManifestSource = PromptDebugImageCategoryWithoutBuffer & {
  filename: string;
  items: NonNullable<PromptDebugImageCategory["items"]>;
};

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function resolvePromptImagesChildEntryUrl() {
  const currentModulePath = fileURLToPath(import.meta.url);
  const preferredExtension = path.extname(currentModulePath) === ".js" ? ".js" : ".ts";
  const preferredUrl = new URL(`./promptImages.child${preferredExtension}`, import.meta.url);
  if (existsSync(fileURLToPath(preferredUrl))) {
    return preferredUrl;
  }

  const fallbackExtension = preferredExtension === ".js" ? ".ts" : ".js";
  return new URL(`./promptImages.child${fallbackExtension}`, import.meta.url);
}

function resolvePromptImagesChildExecArgv(childEntryUrl: URL) {
  return path.extname(fileURLToPath(childEntryUrl)) === ".ts" ? [...process.execArgv] : [];
}

function nowMs() {
  return Date.now();
}

function createPromptImageTimings(): PromptImageTimings {
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

function addTiming(timings: PromptImageTimingState, key: PromptImageTimingKey, startedAt: number) {
  if (!timings || !key || !Number.isFinite(startedAt)) {
    return;
  }

  timings[key] = (Number(timings[key]) || 0) + Math.max(0, nowMs() - startedAt);
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizeFileName(value: unknown) {
  const sanitized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "unknown";
}

function groupPromptImageItemsByCategory(normalizedItems: PromptImageItemLike[] = []): Map<string, PromptImageItemLike[]> {
  const groups = new Map<string, PromptImageItemLike[]>();

  for (const item of normalizedItems) {
    const category = String(item?.category || "").trim();
    if (!category) {
      continue;
    }

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    const group = groups.get(category);
    if (!group) {
      continue;
    }
    if (group.length >= MAX_ITEMS_PER_CATEGORY) {
      continue;
    }

    group.push(item);
  }

  return groups;
}

async function ensureCleanDirectory(outputDir: string) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R> | R): Promise<R[]> {
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

function getMetadataDimensions(metadata: { width?: number | null; height?: number | null } | null | undefined) {
  return {
    width: typeof metadata?.width === "number" ? metadata.width : null,
    height: typeof metadata?.height === "number" ? metadata.height : null
  };
}

function getErrorMessage(error: unknown, fallback = "unknown_error") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function resolveSourceImageUrl(imageUrl: unknown) {
  const trimmed = String(imageUrl ?? "").trim();
  if (!trimmed) {
    return "";
  }

  return getSafeServerFetchUrl(trimmed.replaceAll("{width}", String(REQUEST_IMAGE_WIDTH)));
}

function getOriginalImageUrl(imageUrl: unknown) {
  return String(imageUrl ?? "").trim();
}

function buildLocalImageCachePath(originalImageUrl: unknown) {
  const digest = createHash("sha256")
    .update(String(originalImageUrl || ""), "utf8")
    .digest("hex");
  return path.join(STORAGE_IMAGES_DIR, `${digest}.jpg`);
}

async function readImageFromLocalCache(imageUrl: unknown) {
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
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function createSharpPipeline(buffer: Buffer | Uint8Array | string, { autoRotate = true }: { autoRotate?: boolean } = {}) {
  const pipeline = sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_SOURCE_IMAGE_PIXELS
  });

  if (autoRotate) {
    pipeline.rotate();
  }

  return pipeline;
}

async function normalizeDownloadedImage(buffer: Buffer | Uint8Array) {
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

  const { width, height } = getMetadataDimensions(metadata);

  return {
    buffer: normalizedBuffer,
    mimeType: "image/jpeg",
    width,
    height
  };
}

async function buildPromptTileCompositeInput(buffer: Buffer | Uint8Array, { autoRotate = true }: { autoRotate?: boolean } = {}) {
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

async function downloadProductImageAsset(item: PromptImageItemLike): Promise<PromptImageDownloadResult> {
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
      const { width, height } = getMetadataDimensions(metadata);
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
        width,
        height
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
    const reason = error instanceof Error && error.name === "TimeoutError"
      ? "timeout"
      : getErrorMessage(error, "download_failed");

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

async function downloadPromptImageAsset(
  item: PromptImageItemLike,
  timings: PromptImageTimings | null = null
): Promise<PromptImageDownloadResult> {
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
      const { width, height } = getMetadataDimensions(metadata);
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
        width,
        height
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
    const { width, height } = getMetadataDimensions(metadata);

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
      width,
      height
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError"
      ? "timeout"
      : getErrorMessage(error, "download_failed");

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

async function downloadProductImageAssets(items: PromptImageItemLike[] = []) {
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

function stripCategoryBuffer(category: PromptDebugImageCategory = {}): PromptDebugImageCategoryWithoutBuffer {
  return {
    category: category?.category ?? "",
    mimeType: category?.mimeType ?? "image/jpeg",
    filename: category?.filename ?? "",
    totalItems: Number(category?.totalItems) || 0,
    cachedCount: Number(category?.cachedCount) || 0,
    downloadedCount: Number(category?.downloadedCount) || 0,
    skippedCount: Number(category?.skippedCount) || 0,
    items: Array.isArray(category?.items) ? category.items : []
  };
}

function normalizeManifestCategory(category: PromptDebugImageCategory = {}): PromptDebugImageCategoryManifestSource {
  const stripped = stripCategoryBuffer(category);

  return {
    ...stripped,
    filename: stripped.filename,
    items: stripped.items
  };
}

async function stitchCategoryImagesVertically(categories: PromptDebugImageCategoryWithFile[] = []): Promise<PromptDebugImageStitched | null> {
  const validCategories = categories.filter((category) => category.file.length > 0);
  if (validCategories.length === 0) {
    return null;
  }

  const metadata = await Promise.all(validCategories.map(async (category) => {
    const image = sharp(category.file, {
      failOn: "none",
      limitInputPixels: false
    });
    const info = await image.metadata().catch(() => ({}));
    const { width, height } = getMetadataDimensions(info);
    return {
      width: width || 0,
      height: height || 0
    };
  }));

  const width = Math.max(...metadata.map((entry) => entry.width));
  const height = metadata.reduce((sum, entry) => sum + entry.height, 0);

  if (!width || !height) {
    return null;
  }

  let offsetTop = 0;
  const composites: Array<{ input: string; left: number; top: number }> = validCategories.map((category, index) => {
    const composite = {
      input: category.file,
      left: 0,
      top: offsetTop
    };
    offsetTop += metadata[index].height;
    return composite;
  });

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BACKGROUND_COLOR
    }
  })
    .composite(composites)
    .jpeg({
      quality: CATEGORY_COLLAGE_JPEG_QUALITY,
      mozjpeg: false,
      progressive: false
    })
    .toBuffer();

  return {
    category: "all-categories",
    mimeType: "image/jpeg",
    buffer,
    filename: STITCHED_COLLAGE_FILENAME,
    totalItems: validCategories.reduce((sum, category) => sum + (Number(category?.totalItems) || 0), 0),
    categoryCount: validCategories.length
  };
}

async function saveDebugArtifacts({
  categories,
  stitched = null,
  cachedCount,
  downloadedCount,
  skippedCount,
  debugOutputDir
}: {
  categories: PromptDebugImageCategory[];
  stitched?: PromptDebugImageStitched | null;
  cachedCount: number;
  downloadedCount: number;
  skippedCount: number;
  debugOutputDir: string | URL | null;
}) {
  if (!debugOutputDir) {
    throw new Error("debugOutputDir is required when saveDebugArtifacts is enabled");
  }

  const resolvedOutputDir = debugOutputDir instanceof URL
    ? fileURLToPath(debugOutputDir)
    : path.resolve(String(debugOutputDir));

  const files: string[] = [];
  const manifestCategories: PromptDebugImageCategoryManifest[] = [];

  for (const category of categories) {
    const categoryEntry = normalizeManifestCategory(category);
    const categoryFile = path.join(resolvedOutputDir, categoryEntry.filename);
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

  let stitchedManifest: PromptDebugImageStitchedManifest | null = null;
  if (stitched?.buffer) {
    const stitchedFile = path.join(resolvedOutputDir, stitched.filename || STITCHED_COLLAGE_FILENAME);
    await writeFile(stitchedFile, stitched.buffer);
    files.push(stitchedFile);
    stitchedManifest = {
      category: stitched.category || "all-categories",
      file: stitchedFile,
      totalItems: Number(stitched.totalItems) || 0,
      categoryCount: Number(stitched.categoryCount) || 0
    };
  }

  const manifest: PromptDebugImageManifest = {
    generatedAt: new Date().toISOString(),
    outputDir: resolvedOutputDir,
    cachedCount,
    downloadedCount,
    skippedCount,
    files,
    stitched: stitchedManifest,
    categories: manifestCategories
  };

  const manifestPath = path.join(resolvedOutputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
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
        console.warn("[prompt-images][debug-save-failed]", JSON.stringify({ message: getErrorMessage(error) }));
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

function getNormalizedPromptImageTimings(timings: PromptDebugImageResult["timings"]): PromptImageTimings {
  return {
    ...createPromptImageTimings(),
    ...(timings ?? {})
  };
}

function serializePromptDebugImagesForIpc(result: PromptDebugImageResult = {}): PromptDebugImageResult {
  return {
    cachedCount: Number(result?.cachedCount) || 0,
    downloadedCount: Number(result?.downloadedCount) || 0,
    skippedCount: Number(result?.skippedCount) || 0,
    timings: isRecord(result.timings) ? getNormalizedPromptImageTimings(result.timings) : undefined,
    stitched: result?.stitched
      ? {
        category: result.stitched?.category ?? "all-categories",
        mimeType: result.stitched?.mimeType ?? "image/jpeg",
        filename: result.stitched?.filename ?? STITCHED_COLLAGE_FILENAME,
        totalItems: Number(result.stitched?.totalItems) || 0,
        categoryCount: Number(result.stitched?.categoryCount) || 0,
        buffer: Buffer.isBuffer(result.stitched?.buffer)
          ? result.stitched.buffer
          : result.stitched?.buffer instanceof Uint8Array
            ? Buffer.from(result.stitched.buffer)
            : null
      }
      : null,
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

function isSerializedIpcBuffer(value: unknown): value is SerializedIpcBuffer {
  if (!isRecord(value)) {
    return false;
  }

  return value.type === "Buffer"
    && Array.isArray(value.data)
    && value.data.every((entry) => Number.isInteger(entry));
}

function normalizeIpcBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (isSerializedIpcBuffer(value)) {
    return Buffer.from(value.data);
  }

  return null;
}

function deserializePromptDebugImagesFromIpc(payload: PromptDebugImageResult = {}): PromptDebugImageResult {
  return {
    cachedCount: Number(payload?.cachedCount) || 0,
    downloadedCount: Number(payload?.downloadedCount) || 0,
    skippedCount: Number(payload?.skippedCount) || 0,
    timings: getNormalizedPromptImageTimings(isRecord(payload.timings) ? payload.timings : undefined),
    stitched: payload?.stitched
      ? {
        category: payload.stitched?.category ?? "all-categories",
        mimeType: payload.stitched?.mimeType ?? "image/jpeg",
        filename: payload.stitched?.filename ?? STITCHED_COLLAGE_FILENAME,
        totalItems: Number(payload.stitched?.totalItems) || 0,
        categoryCount: Number(payload.stitched?.categoryCount) || 0,
        buffer: normalizeIpcBuffer(payload.stitched?.buffer)
          || (
            typeof payload.stitched?.bufferBase64 === "string" && payload.stitched.bufferBase64.length > 0
              ? Buffer.from(payload.stitched.bufferBase64, "base64")
              : null
          )
      }
      : null,
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

function isValidPromptImagesIpcPayload(message: unknown): message is PromptImagesChildSuccessPayload {
  if (!isRecord(message)) {
    return false;
  }

  const payload = message as PromptImagesChildSuccessPayload;
  if (!Array.isArray(payload.categories)) {
    return false;
  }

  const hasValidStitched = payload.stitched != null && (
    normalizeIpcBuffer(payload.stitched?.buffer) !== null
    || typeof payload.stitched?.bufferBase64 === "string"
  );

  const allCategoriesValid = payload.categories.every((category) => (
    normalizeIpcBuffer(category?.buffer) !== null
    || typeof category?.bufferBase64 === "string"
    || category?.buffer == null
  ));

  return hasValidStitched || allCategoriesValid;
}

async function buildPromptDebugImagesInChild({
  normalizedItems = [],
  debugOutputDir = null,
  saveDebugArtifacts: shouldSaveDebugArtifacts = false,
  forkImpl = nodeFork
}: {
  normalizedItems?: PromptImageItemLike[];
  debugOutputDir?: string | URL | null;
  saveDebugArtifacts?: boolean;
  forkImpl?: PromptImagesFork;
} = {}) {
  const childRoundTripStartedAt = nowMs();
  const result: PromptDebugImageResult = await buildPromptDebugImagesAllInChild({
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
        stitched: result.stitched,
        cachedCount: result.cachedCount,
        downloadedCount: result.downloadedCount,
        skippedCount: result.skippedCount,
        debugOutputDir
      });
      addTiming(result.timings, "debugSaveMs", debugSaveStartedAt);
    } catch (error) {
      console.warn("[prompt-images][debug-save-failed]", JSON.stringify({ message: getErrorMessage(error) }));
    }
  }

  return result;
}

async function buildPromptDebugImagesAllInChild({
  normalizedItems = [],
  forkImpl = nodeFork
}: {
  normalizedItems?: PromptImageItemLike[];
  forkImpl?: PromptImagesFork;
} = {}) {
  return new Promise<PromptDebugImageResult>((resolve, reject) => {
    const childEntryUrl = resolvePromptImagesChildEntryUrl();
    const child = forkImpl(fileURLToPath(childEntryUrl), {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: resolvePromptImagesChildExecArgv(childEntryUrl)
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

    function resolveOnce(value: PromptDebugImageResult) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    }

    function rejectOnce(error: Error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    }

    function onMessage(message: PromptImagesChildPayload) {
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

    function onError(error: Error) {
      rejectOnce(error);
    }

    function onExit(code: number | null, signal: NodeJS.Signals | null) {
      childExited = true;
      if (!settled) {
        rejectOnce(new Error(`prompt_images_child_exit:${code ?? "null"}:${signal ?? "null"}`));
      }
    }

    child.on("message", onMessage);
    child.on("error", onError);
    child.on("exit", onExit);

    const message: PromptImagesChildMessage = {
      normalizedItems,
      downloadConcurrency: PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY
    };

    child.send(message, (error: Error | null) => {
      if (error && !childExited) {
        rejectOnce(error);
      }
    });
  });
}

async function preparePdfImageAsset(
  imageAsset: PromptImageAsset | null | undefined,
  { width, height }: { width?: number; height?: number } = {}
) {
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
  const dimensions = getMetadataDimensions(metadata);

  return {
    buffer,
    mimeType: "image/jpeg",
    kind: "jpg",
    preparedForPdf: true,
    imageUrl: imageAsset.imageUrl || "",
    width: dimensions.width,
    height: dimensions.height
  };
}

async function preparePdfImageAssets(
  imageAssetsById: Record<string, PromptImageAsset> = {},
  targetSize?: { width?: number; height?: number }
) {
  const entries = Object.entries(imageAssetsById).filter(([, asset]) => Boolean(asset?.buffer));
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
