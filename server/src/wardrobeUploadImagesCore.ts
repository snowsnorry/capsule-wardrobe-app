import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WARDROBE_UPLOAD_FIELD_NAME = "images";
export const WARDROBE_UPLOAD_MAX_FILES = 5;
export const WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const WARDROBE_UPLOAD_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const WARDROBE_UPLOAD_IMAGE_MAX_DIMENSION = 1600;
export const WARDROBE_UPLOAD_WEBP_QUALITY = 82;
export const WARDROBE_UPLOAD_BACKGROUND = "#f7f5f1";
export const WARDROBE_UPLOAD_CHILD_TIMEOUT_MS =
  Number.parseInt(process.env.WARDROBE_UPLOAD_CHILD_TIMEOUT_MS || "", 10) ||
  120000;

type WardrobeUploadChildProcessLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => unknown;
  kill: () => unknown;
  send: (message: unknown, callback?: (error: Error | null) => void) => unknown;
};

export type WardrobeUploadForkLike = (
  modulePath: string,
  options?: Record<string, unknown>,
) => WardrobeUploadChildProcessLike;

export type WardrobeUploadImageInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export type WardrobeUploadNormalizedImage = {
  filePath: string;
  mimeType: "image/webp";
  originalName: string;
  width: number | null;
  height: number | null;
  size: number;
};

export type WardrobeUploadChildMessage = {
  images?: Array<{
    buffer?: unknown;
    mimeType?: unknown;
    originalName?: unknown;
  }>;
  outputDir?: unknown;
};

export type WardrobeUploadChildPayload =
  | {
      ok: true;
      images: WardrobeUploadNormalizedImage[];
    }
  | {
      ok: false;
      message: string;
      stack?: string | null;
    };

export function resolveWardrobeUploadChildEntryUrl() {
  const currentModulePath = fileURLToPath(import.meta.url);
  const preferredExtension =
    path.extname(currentModulePath) === ".js" ? ".js" : ".ts";
  const preferredUrl = new URL(
    `./wardrobeUploadImages.child${preferredExtension}`,
    import.meta.url,
  );
  if (existsSync(fileURLToPath(preferredUrl))) {
    return preferredUrl;
  }

  const fallbackExtension = preferredExtension === ".js" ? ".ts" : ".js";
  return new URL(
    `./wardrobeUploadImages.child${fallbackExtension}`,
    import.meta.url,
  );
}

export function resolveWardrobeUploadChildExecArgv(childEntryUrl: URL) {
  return path.extname(fileURLToPath(childEntryUrl)) === ".ts"
    ? [...process.execArgv]
    : [];
}

function isSerializedBuffer(value: unknown): value is { data: number[] } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "Buffer" &&
    Array.isArray((value as { data?: unknown }).data)
  );
}

export function normalizeIpcBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (isSerializedBuffer(value)) {
    return Buffer.from(value.data);
  }

  return null;
}

export function isAllowedWardrobeUploadMimeType(
  value: unknown,
): value is (typeof WARDROBE_UPLOAD_ALLOWED_MIME_TYPES)[number] {
  return WARDROBE_UPLOAD_ALLOWED_MIME_TYPES.includes(value as never);
}

export function getWardrobeUploadChildErrorMessage(error: unknown) {
  return {
    ok: false,
    message:
      error instanceof Error ? error.message : String(error || "unknown_error"),
    stack:
      error instanceof Error && typeof error.stack === "string"
        ? error.stack
        : null,
  };
}
