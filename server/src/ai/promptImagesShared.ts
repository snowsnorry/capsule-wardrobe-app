import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSafeServerFetchUrl } from "../serverUrlSecurity.js";
import type {
  PromptDebugImageCategory,
  PromptImageItemLike,
  PromptImageTimingKey,
  PromptImageTimings
} from "./types.js";

export const TILE_SIZE = 320;
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 2;
export const MAX_ITEMS_PER_CATEGORY = GRID_COLUMNS * GRID_ROWS;
export const GRID_WIDTH = TILE_SIZE * GRID_COLUMNS;
export const GRID_HEIGHT = TILE_SIZE * GRID_ROWS;
export const HEADER_HEIGHT = 120;
export const BORDER_WIDTH = 8;
export const GRID_COLOR = "#d10f0f";
export const BACKGROUND_COLOR = "#E4E7EA";
export const LABEL_BACKGROUND_COLOR = "#FFFFFF";
export const TILE_LABEL_FONT_SIZE = 28;
export const TILE_LABEL_BACKGROUND_HEIGHT = 34;
export const TILE_LABEL_BACKGROUND_MIN_WIDTH = 54;
export const TILE_LABEL_BACKGROUND_PADDING_X = 10;
export const HEADER_FONT_SIZE = 42;
export const REQUEST_TIMEOUT_MS = 15000;
export const CATEGORY_COLLAGE_JPEG_QUALITY = 60;
export const NORMALIZED_IMAGE_JPEG_QUALITY = 80;
export const PDF_IMAGE_JPEG_QUALITY = 76;
export const MAX_SOURCE_IMAGE_PIXELS = Number.parseInt(process.env.MAX_SOURCE_IMAGE_PIXELS || "", 10) || 16000000;
export const REQUEST_IMAGE_WIDTH = Number.parseInt(process.env.PROMPT_IMAGE_REQUEST_WIDTH || "", 10) || 1000;
export const PROMPT_IMAGES_CHILD_TIMEOUT_MS = Number.parseInt(process.env.PROMPT_IMAGES_CHILD_TIMEOUT_MS || "", 10) || 120000;
export const PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY || "", 10) || 5;
export const STITCHED_COLLAGE_FILENAME = "categories-stitched.jpg";

export type PromptImagesChildProcessLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => unknown;
  kill: () => unknown;
  send: (message: unknown, callback?: (error: Error | null) => void) => unknown;
};

export type PromptImagesFork = (modulePath: string, options?: Record<string, unknown>) => PromptImagesChildProcessLike;
export type PromptImageTimingState = PromptImageTimings | Partial<PromptImageTimings> | null | undefined;
export type PromptDebugImageCategoryWithFile = PromptDebugImageCategory & { file: string };
export type PromptDebugImageCategoryWithoutBuffer = Omit<PromptDebugImageCategory, "buffer" | "bufferBase64" | "file">;
export type PromptDebugImageCategoryManifestSource = PromptDebugImageCategoryWithoutBuffer & {
  filename: string;
  items: NonNullable<PromptDebugImageCategory["items"]>;
};

export function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function resolvePromptImagesChildEntryUrl() {
  const currentModulePath = fileURLToPath(import.meta.url);
  const preferredExtension = path.extname(currentModulePath) === ".js" ? ".js" : ".ts";
  const preferredUrl = new URL(`./promptImages.child${preferredExtension}`, import.meta.url);
  if (existsSync(fileURLToPath(preferredUrl))) {
    return preferredUrl;
  }

  const fallbackExtension = preferredExtension === ".js" ? ".ts" : ".js";
  return new URL(`./promptImages.child${fallbackExtension}`, import.meta.url);
}

export function resolvePromptImagesChildExecArgv(childEntryUrl: URL) {
  return path.extname(fileURLToPath(childEntryUrl)) === ".ts" ? [...process.execArgv] : [];
}

export function findRepositoryRoot(startDir: string) {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (
      existsSync(path.join(currentDir, "package.json")) &&
      existsSync(path.join(currentDir, "server", "package.json"))
    ) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return "";
    }
    currentDir = parentDir;
  }
}

export function resolveStorageImagesDir(moduleUrl = import.meta.url) {
  const configuredDir = String(process.env.STORAGE_IMAGES_DIR || "").trim();
  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const repositoryRoot = findRepositoryRoot(moduleDir);
  if (repositoryRoot) {
    return path.join(repositoryRoot, "storage", "images");
  }

  return fileURLToPath(new URL("../../../storage/images/", moduleUrl));
}

export const STORAGE_IMAGES_DIR = resolveStorageImagesDir();

export function nowMs() {
  return Date.now();
}

export function createPromptImageTimings(): PromptImageTimings {
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

export function addTiming(timings: PromptImageTimingState, key: PromptImageTimingKey, startedAt: number) {
  if (!timings || !key || !Number.isFinite(startedAt)) {
    return;
  }

  timings[key] = (Number(timings[key]) || 0) + Math.max(0, nowMs() - startedAt);
}

export function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function sanitizeFileName(value: unknown) {
  const sanitized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "unknown";
}

export function groupPromptImageItemsByCategory(normalizedItems: PromptImageItemLike[] = []): Map<string, PromptImageItemLike[]> {
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

export async function ensureCleanDirectory(outputDir: string) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R> | R): Promise<R[]> {
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

export function getRequestSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  return undefined;
}

export function getMetadataDimensions(metadata: { width?: number | null; height?: number | null } | null | undefined) {
  return {
    width: typeof metadata?.width === "number" ? metadata.width : null,
    height: typeof metadata?.height === "number" ? metadata.height : null
  };
}

export function getErrorMessage(error: unknown, fallback = "unknown_error") {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function resolveSourceImageUrl(imageUrl: unknown) {
  const trimmed = String(imageUrl ?? "").trim();
  if (!trimmed) {
    return "";
  }

  return getSafeServerFetchUrl(trimmed.replaceAll("{width}", String(REQUEST_IMAGE_WIDTH)));
}

export function getOriginalImageUrl(imageUrl: unknown) {
  return String(imageUrl ?? "").trim();
}

export function buildLocalImageCachePath(originalImageUrl: unknown) {
  const digest = createHash("sha256")
    .update(String(originalImageUrl || ""), "utf8")
    .digest("hex");
  return path.join(STORAGE_IMAGES_DIR, `${digest}.jpg`);
}

export async function readImageFromLocalCache(imageUrl: unknown) {
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

export function createSharpPipeline(buffer: Buffer | Uint8Array | string, { autoRotate = true }: { autoRotate?: boolean } = {}) {
  const pipeline = sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_SOURCE_IMAGE_PIXELS
  });

  if (autoRotate) {
    pipeline.rotate();
  }

  return pipeline;
}

export async function normalizeDownloadedImage(buffer: Buffer | Uint8Array) {
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

export async function buildPromptTileCompositeInput(buffer: Buffer | Uint8Array, { autoRotate = true }: { autoRotate?: boolean } = {}) {
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
