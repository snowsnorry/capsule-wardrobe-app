import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { rgb } from "pdf-lib";
import {
  readImageFromLocalCache,
  resolveSourceImageUrl,
} from "./ai/promptImages.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";
import {
  isSupportedLocale,
  normalizeLocale,
} from "../../shared/i18n/helpers.js";
import { logError } from "./logger.js";
import type {
  ProfileWithItemsLike,
  PromptImageAsset,
  WardrobeUiItemLike,
} from "./ai/types.js";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const PAGE_MARGIN = 54;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
export const BOX_PADDING = 13;
export const BLOCK_RADIUS = 16.5;
export const LINK_COLOR = rgb(0.56, 0.44, 0.27);
export const SUBTLE_BLOCK_COLOR = rgb(0.96, 0.965, 0.972);
export const IMAGE_BACKGROUND_COLOR = rgb(0.97, 0.96, 0.94);
const require = createRequire(import.meta.url);
export const DM_SANS_REGULAR_PATH =
  require.resolve("@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff");
export const DM_SANS_BOLD_PATH =
  require.resolve("@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff");
export const FALLBACK_REGULAR_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
];
export const FALLBACK_BOLD_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
];
export const WARDROBE_PDF_POLL_AFTER_MS = 2000;
export const PDF_JOB_TTL_MS = 5 * 60 * 1000;
export const WARDROBE_PDF_CHILD_TIMEOUT_MS =
  Number.parseInt(process.env.WARDROBE_PDF_CHILD_TIMEOUT_MS || "", 10) ||
  180000;

export type PdfImageBytes = {
  kind: "jpg" | "png";
  bytes: Buffer;
};

export type PdfTargetSize = {
  width: number;
  height: number;
  autoRotate?: boolean;
};

export type ProductLike = {
  id?: string | null;
  url?: string | null;
  name?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  brand?: string | null;
  description?: string | null;
  [key: string]: unknown;
};

export type WardrobePdfJobOptions = {
  wardrobePayload?: ProfileWithItemsLike["items"] | null;
  locale?: string | null;
};

export type OutfitPdfOptions = {
  title?: string | null;
  imageUrl?: string | null;
  imageStale?: boolean;
  report?: Record<string, unknown> | null;
  reportStale?: boolean;
};

export type ProfileWithPdfResult = {
  profile: ProfileWithItemsLike | null;
  pdf: Buffer | Uint8Array | number[] | null;
};

export type UpdateProfilePdfImpl = (
  email: string,
  pdf: Buffer,
  options?: {
    expectedItems?: WardrobePdfJobOptions["wardrobePayload"];
    expectedLocale?: string | null;
  },
) => Promise<unknown>;

export type ChildMessage =
  | {
      ok: true;
      outputFilePath?: string | null;
    }
  | {
      ok: false;
      message?: string | null;
      stack?: string | null;
    };

type WardrobePdfChildProcessLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => unknown;
  kill: () => unknown;
  send: (message: unknown, callback?: (error: Error | null) => void) => unknown;
};

export function resolveWardrobePdfChildEntryUrl() {
  const currentModulePath = fileURLToPath(import.meta.url);
  const preferredExtension =
    path.extname(currentModulePath) === ".js" ? ".js" : ".ts";
  const preferredUrl = new URL(
    `./wardrobePdf.child${preferredExtension}`,
    import.meta.url,
  );
  if (existsSync(fileURLToPath(preferredUrl))) {
    return preferredUrl;
  }

  const fallbackExtension = preferredExtension === ".js" ? ".ts" : ".js";
  return new URL(`./wardrobePdf.child${fallbackExtension}`, import.meta.url);
}

export function resolveWardrobePdfChildExecArgv(childEntryUrl: URL) {
  return path.extname(fileURLToPath(childEntryUrl)) === ".ts"
    ? process.execArgv
    : [];
}

export type WardrobePdfForkLike = (
  modulePath: string,
  options?: Record<string, unknown>,
) => WardrobePdfChildProcessLike;
export {
  formatLogPayload,
  formatLogValue,
  hasNonLatinText,
  logPdfEvent,
  productNeedsUnicodeFallback,
  resolveFontPath,
} from "./wardrobePdfRuntime.js";

export function getStoredWardrobeItems(profile: unknown): WardrobeUiItemLike[] {
  const stored =
    profile && typeof profile === "object"
      ? (profile as { items?: unknown }).items
      : undefined;

  if (Array.isArray(stored)) {
    return stored;
  }

  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return [];
  }

  return Array.isArray((stored as { items?: unknown }).items)
    ? (stored as { items: WardrobeUiItemLike[] }).items
    : [];
}

export function createWardrobePdfGenerationKey({
  items = [],
  locale = "en",
} = {}) {
  return JSON.stringify({
    locale,
    items: sortWardrobeItems(items).map((item) =>
      String(item?.url || item?.id || `${item?.category}:${item?.name}`),
    ),
  });
}

export function normalizeStoredPdf(pdf) {
  if (!pdf) {
    return null;
  }

  if (Buffer.isBuffer(pdf)) {
    return pdf;
  }

  if (pdf instanceof Uint8Array) {
    return Buffer.from(pdf);
  }

  if (Array.isArray(pdf)) {
    return Buffer.from(pdf);
  }

  return null;
}

export function getPdfLocale(rawLocale) {
  const locale = normalizeLocale(String(rawLocale || ""));
  return isSupportedLocale(locale) ? locale : "en";
}

export async function normalizeImageBytes(
  buffer: Buffer | Uint8Array | null | undefined,
  mimeType = "",
): Promise<PdfImageBytes | null> {
  if (!buffer) {
    return null;
  }

  const contentType = String(mimeType || "").toLowerCase();
  const sourceBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return { kind: "jpg", bytes: sourceBuffer };
  }

  if (contentType.includes("png")) {
    return { kind: "png", bytes: sourceBuffer };
  }

  const pngBuffer = await sharp(sourceBuffer).png().toBuffer();
  return { kind: "png", bytes: pngBuffer };
}

export async function preparePdfImageBytes(
  buffer: Buffer | Uint8Array | null | undefined,
  mimeType = "",
  { width, height, autoRotate = true }: PdfTargetSize,
): Promise<PdfImageBytes | null> {
  if (!buffer) {
    return null;
  }

  const sourceBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const targetWidth = Math.max(1, Math.round(Number(width) || 1));
  const targetHeight = Math.max(1, Math.round(Number(height) || 1));
  const image = sharp(sourceBuffer, { failOn: "none" });
  if (autoRotate) {
    image.rotate();
  }
  const metadata = await image.metadata().catch(() => null);
  const hasAlpha =
    metadata?.hasAlpha === true ||
    String(mimeType || "")
      .toLowerCase()
      .includes("png");

  const resized = image.resize(targetWidth, targetHeight, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (hasAlpha) {
    const pngBuffer = await resized
      .png({
        compressionLevel: 9,
        palette: true,
        quality: 80,
      })
      .toBuffer();
    return { kind: "png", bytes: pngBuffer };
  }

  const jpgBuffer = await resized
    .flatten({ background: "#f7f4ef" })
    .jpeg({
      quality: 76,
      mozjpeg: true,
      progressive: true,
    })
    .toBuffer();
  return { kind: "jpg", bytes: jpgBuffer };
}

export async function loadImageBytes(
  imageUrl: string | null | undefined,
  imageAsset: PromptImageAsset | null = null,
  targetSize: PdfTargetSize | null = null,
  imageLoadStats: {
    cachedCount: number;
    downloadedCount: number;
  } | null = null,
): Promise<PdfImageBytes | null> {
  const stats = imageLoadStats || { cachedCount: 0, downloadedCount: 0 };
  const resolvedImageUrl = resolveSourceImageUrl(imageUrl);
  const assetBytes = await getPdfImageAssetBytes(imageAsset, targetSize);

  if (assetBytes) {
    return assetBytes;
  }

  if (
    typeof resolvedImageUrl !== "string" ||
    resolvedImageUrl.trim().length === 0
  ) {
    return null;
  }

  try {
    return await getCachedOrDownloadedPdfImageBytes({
      imageUrl,
      resolvedImageUrl,
      targetSize,
      stats,
    });
  } catch (error) {
    logError("[wardrobe-pdf][image]", resolvedImageUrl, error);
    return null;
  }
}

async function getPdfImageAssetBytes(
  imageAsset: PromptImageAsset | null,
  targetSize: PdfTargetSize | null,
): Promise<PdfImageBytes | null> {
  if (!imageAsset?.buffer) {
    return null;
  }

  if (imageAsset.preparedForPdf && imageAsset.kind === "jpg") {
    return { kind: "jpg", bytes: imageAsset.buffer };
  }

  return targetSize
    ? preparePdfImageBytes(imageAsset.buffer, imageAsset.mimeType, targetSize)
    : normalizeImageBytes(imageAsset.buffer, imageAsset.mimeType);
}

async function getCachedOrDownloadedPdfImageBytes({
  imageUrl,
  resolvedImageUrl,
  targetSize,
  stats,
}: {
  imageUrl: string | null | undefined;
  resolvedImageUrl: string;
  targetSize: PdfTargetSize | null;
  stats: { cachedCount: number; downloadedCount: number };
}): Promise<PdfImageBytes | null> {
  const cachedImage = await readImageFromLocalCache(imageUrl);
  if (cachedImage?.buffer) {
    stats.cachedCount += 1;
    return normalizeImageBytes(cachedImage.buffer, cachedImage.mimeType);
  }

  stats.downloadedCount += 1;
  return getDownloadedPdfImageBytes(resolvedImageUrl, targetSize);
}

async function getDownloadedPdfImageBytes(
  resolvedImageUrl: string,
  targetSize: PdfTargetSize | null,
): Promise<PdfImageBytes | null> {
  const response = await fetch(resolvedImageUrl, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`image_fetch_failed_${response.status}`);
  }

  const contentType = String(
    response.headers.get("content-type") || "",
  ).toLowerCase();
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  return targetSize
    ? preparePdfImageBytes(sourceBuffer, contentType, targetSize)
    : normalizeImageBytes(sourceBuffer, contentType);
}
