import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WardrobeImageAnalysisResult } from "./wardrobeImageAnalysis.js";

export const WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS =
  Number.parseInt(
    process.env.WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS || "",
    10,
  ) ||
  Number.parseInt(process.env.WARDROBE_UPLOAD_CHILD_TIMEOUT_MS || "", 10) ||
  120000;
export const WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS =
  Number.parseInt(
    process.env.WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS || "",
    10,
  ) || 1000;

type WardrobeUploadProcessingKind = "file" | "url";

type WardrobeUploadProcessingFileInput = {
  filePath: string;
  inputIndex: number;
  kind: "file";
  mimeType: string;
  originalName: string;
};

type WardrobeUploadProcessingUrlInput = {
  inputIndex: number;
  kind: "url";
  url: string;
};

type WardrobeUploadProcessingInput =
  WardrobeUploadProcessingFileInput | WardrobeUploadProcessingUrlInput;

type WardrobeUploadProcessingPayload = {
  email: string;
  imageLlm: string;
  items: WardrobeUploadProcessingInput[];
};

type WardrobeUploadProcessingSource = {
  imageUrl: string;
  kind: "file" | "direct-image";
  productPageUrl: string;
  rawImageUrl: string;
  sourceImageKey: string | null;
  sourceImageUrl: string | null;
};

type WardrobeUploadProcessingCleanup = {
  cleanImage: {
    digest: string;
    key: string;
    url: string;
  };
  thumbnails: Array<{
    digest: string;
    key: string;
    url: string;
    width: number;
  }>;
};

type WardrobeUploadProcessingResult = {
  analysis?: WardrobeImageAnalysisResult | null;
  cleanup?: WardrobeUploadProcessingCleanup | null;
  inputIndex: number;
  message?: string | null;
  ok: boolean;
  source?: WardrobeUploadProcessingSource | null;
  stack?: string | null;
};

type WardrobeUploadProcessingEventName =
  | "item-started"
  | "source-uploaded"
  | "metadata-ready"
  | "image-cleaned"
  | "item-failed"
  | "item-complete";

type WardrobeUploadProcessingEvent = {
  event: WardrobeUploadProcessingEventName;
  inputIndex: number;
  kind?: WardrobeUploadProcessingKind | "direct-image";
  message?: string | null;
  source?: WardrobeUploadProcessingSource | null;
  type: "event";
};

type WardrobeUploadProcessingChildMessage =
  | WardrobeUploadProcessingEvent
  | {
      ok: true;
      results: WardrobeUploadProcessingResult[];
      type: "result";
    }
  | {
      message: string;
      ok: false;
      stack?: string | null;
      type: "result";
    };

type WardrobeUploadProcessingChildProcessLike = {
  kill: (signal?: NodeJS.Signals | number) => unknown;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => unknown;
  send: (message: unknown, callback?: (error: Error | null) => void) => unknown;
};

type WardrobeUploadProcessingForkLike = (
  modulePath: string,
  options?: Record<string, unknown>,
) => WardrobeUploadProcessingChildProcessLike;

function resolveWardrobeUploadProcessingChildEntryUrl() {
  const currentModulePath = fileURLToPath(import.meta.url);
  const preferredExtension =
    path.extname(currentModulePath) === ".js" ? ".js" : ".ts";
  const preferredUrl = new URL(
    `./wardrobeUploadProcessing.child${preferredExtension}`,
    import.meta.url,
  );
  if (existsSync(fileURLToPath(preferredUrl))) {
    return preferredUrl;
  }

  const fallbackExtension = preferredExtension === ".js" ? ".ts" : ".js";
  return new URL(
    `./wardrobeUploadProcessing.child${fallbackExtension}`,
    import.meta.url,
  );
}

function resolveWardrobeUploadProcessingChildExecArgv(childEntryUrl: URL) {
  return path.extname(fileURLToPath(childEntryUrl)) === ".ts"
    ? [...process.execArgv]
    : [];
}

function getWardrobeUploadProcessingErrorMessage(error: unknown) {
  return {
    message:
      error instanceof Error ? error.message : String(error || "unknown_error"),
    stack:
      error instanceof Error && typeof error.stack === "string"
        ? error.stack
        : null,
  };
}

export {
  getWardrobeUploadProcessingErrorMessage,
  resolveWardrobeUploadProcessingChildEntryUrl,
  resolveWardrobeUploadProcessingChildExecArgv,
};
export type {
  WardrobeUploadProcessingChildMessage,
  WardrobeUploadProcessingChildProcessLike,
  WardrobeUploadProcessingCleanup,
  WardrobeUploadProcessingEvent,
  WardrobeUploadProcessingForkLike,
  WardrobeUploadProcessingInput,
  WardrobeUploadProcessingPayload,
  WardrobeUploadProcessingResult,
  WardrobeUploadProcessingSource,
};
