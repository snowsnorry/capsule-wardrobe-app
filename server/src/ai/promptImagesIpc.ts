import { fork as nodeFork } from "node:child_process";
import { fileURLToPath } from "node:url";
import type {
  PromptDebugImageResult,
  PromptImageItemLike,
  PromptImagesChildMessage,
  PromptImagesChildPayload,
  PromptImagesChildSuccessPayload,
  SerializedIpcBuffer,
} from "./types.js";
import {
  PROMPT_IMAGES_CHILD_TIMEOUT_MS,
  PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY,
  STITCHED_COLLAGE_FILENAME,
  addTiming,
  createPromptImageTimings,
  getErrorMessage,
  isRecord,
  nowMs,
  resolvePromptImagesChildEntryUrl,
  resolvePromptImagesChildExecArgv,
  type PromptImagesFork,
} from "./promptImagesShared.js";
import {
  getNormalizedPromptImageTimings,
  saveDebugArtifacts,
} from "./promptImageArtifacts.js";
import { logWarn } from "../logger.js";

function serializePromptDebugImagesForIpc(
  result: PromptDebugImageResult = {},
): PromptDebugImageResult {
  return {
    cachedCount: Number(result?.cachedCount) || 0,
    downloadedCount: Number(result?.downloadedCount) || 0,
    skippedCount: Number(result?.skippedCount) || 0,
    timings: isRecord(result.timings)
      ? getNormalizedPromptImageTimings(result.timings)
      : undefined,
    stitched: serializePromptStitchedImage(result.stitched),
    categories: Array.isArray(result?.categories)
      ? result.categories.map(serializePromptCategoryImage)
      : [],
  };
}

function serializePromptStitchedImage(
  stitched: PromptDebugImageResult["stitched"],
) {
  return stitched
    ? {
        ...getPromptStitchedMetadata(stitched),
        buffer: normalizeDirectIpcBuffer(stitched.buffer),
      }
    : null;
}

function serializePromptCategoryImage(category) {
  return {
    ...getPromptCategoryMetadata(category),
    buffer: normalizeDirectIpcBuffer(category?.buffer),
  };
}

function getPromptStitchedMetadata(stitched) {
  return {
    category: getIpcString(stitched?.category, "all-categories"),
    mimeType: getIpcString(stitched?.mimeType, "image/jpeg"),
    filename: getIpcString(stitched?.filename, STITCHED_COLLAGE_FILENAME),
    totalItems: getIpcNumber(stitched?.totalItems),
    categoryCount: getIpcNumber(stitched?.categoryCount),
  };
}

function getPromptCategoryMetadata(category) {
  return {
    category: getIpcString(category?.category, ""),
    mimeType: getIpcString(category?.mimeType, "image/jpeg"),
    filename: getIpcString(category?.filename, ""),
    totalItems: getIpcNumber(category?.totalItems),
    cachedCount: getIpcNumber(category?.cachedCount),
    downloadedCount: getIpcNumber(category?.downloadedCount),
    skippedCount: getIpcNumber(category?.skippedCount),
    items: Array.isArray(category?.items) ? category.items : [],
  };
}

function getIpcString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getIpcNumber(value: unknown): number {
  return Number(value) || 0;
}

function normalizeDirectIpcBuffer(value: unknown): Buffer | null {
  return Buffer.isBuffer(value)
    ? value
    : value instanceof Uint8Array
      ? Buffer.from(value)
      : null;
}

function isSerializedIpcBuffer(value: unknown): value is SerializedIpcBuffer {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === "Buffer" &&
    Array.isArray(value.data) &&
    value.data.every((entry) => Number.isInteger(entry))
  );
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

function deserializePromptDebugImagesFromIpc(
  payload: PromptDebugImageResult = {},
): PromptDebugImageResult {
  return {
    cachedCount: Number(payload?.cachedCount) || 0,
    downloadedCount: Number(payload?.downloadedCount) || 0,
    skippedCount: Number(payload?.skippedCount) || 0,
    timings: getNormalizedPromptImageTimings(
      isRecord(payload.timings) ? payload.timings : undefined,
    ),
    stitched: deserializePromptStitchedImage(payload.stitched),
    categories: Array.isArray(payload?.categories)
      ? payload.categories.map(deserializePromptCategoryImage)
      : [],
  };
}

function deserializePromptStitchedImage(
  stitched: PromptDebugImageResult["stitched"],
) {
  return stitched
    ? {
        ...getPromptStitchedMetadata(stitched),
        buffer:
          normalizeIpcBuffer(stitched?.buffer) ||
          normalizeBase64IpcBuffer(stitched?.bufferBase64),
      }
    : null;
}

function deserializePromptCategoryImage(category) {
  return {
    ...getPromptCategoryMetadata(category),
    buffer:
      normalizeIpcBuffer(category?.buffer) ||
      normalizeBase64IpcBuffer(category?.bufferBase64),
  };
}

function normalizeBase64IpcBuffer(value: unknown): Buffer | null {
  return typeof value === "string" && value.length > 0
    ? Buffer.from(value, "base64")
    : null;
}

function isValidPromptImagesIpcPayload(
  message: unknown,
): message is PromptImagesChildSuccessPayload {
  if (!isRecord(message)) {
    return false;
  }

  const payload = message as PromptImagesChildSuccessPayload;
  if (!Array.isArray(payload.categories)) {
    return false;
  }

  const hasValidStitched =
    payload.stitched != null &&
    (normalizeIpcBuffer(payload.stitched?.buffer) !== null ||
      typeof payload.stitched?.bufferBase64 === "string");

  const allCategoriesValid = payload.categories.every(
    (category) =>
      normalizeIpcBuffer(category?.buffer) !== null ||
      typeof category?.bufferBase64 === "string" ||
      category?.buffer == null,
  );

  return hasValidStitched || allCategoriesValid;
}

async function buildPromptDebugImagesInChild({
  normalizedItems = [],
  debugOutputDir = null,
  saveDebugArtifacts: shouldSaveDebugArtifacts = false,
  forkImpl = nodeFork,
}: {
  normalizedItems?: PromptImageItemLike[];
  debugOutputDir?: string | URL | null;
  saveDebugArtifacts?: boolean;
  forkImpl?: PromptImagesFork;
} = {}) {
  const childRoundTripStartedAt = nowMs();
  const result: PromptDebugImageResult = await buildPromptDebugImagesAllInChild(
    {
      normalizedItems,
      forkImpl,
    },
  );
  result.timings = {
    ...createPromptImageTimings(),
    ...(result.timings && typeof result.timings === "object"
      ? result.timings
      : {}),
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
        debugOutputDir,
      });
      addTiming(result.timings, "debugSaveMs", debugSaveStartedAt);
    } catch (error) {
      logWarn(
        "[prompt-images][debug-save-failed]",
        JSON.stringify({ message: getErrorMessage(error) }),
      );
    }
  }

  return result;
}

type BuildPromptDebugImagesAllInChildParams = {
  normalizedItems?: PromptImageItemLike[];
  forkImpl?: PromptImagesFork;
};

async function buildPromptDebugImagesAllInChild({
  normalizedItems = [],
  forkImpl = nodeFork,
}: BuildPromptDebugImagesAllInChildParams = {}) {
  return new Promise<PromptDebugImageResult>((resolve, reject) => {
    const childEntryUrl = resolvePromptImagesChildEntryUrl();
    const child = forkImpl(fileURLToPath(childEntryUrl), {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: resolvePromptImagesChildExecArgv(childEntryUrl),
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
        const error = new Error(
          String(message?.message || "prompt_images_child_failed"),
        );
        if (
          typeof message?.stack === "string" &&
          message.stack.trim().length > 0
        ) {
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
        rejectOnce(
          new Error(
            `prompt_images_child_exit:${code ?? "null"}:${signal ?? "null"}`,
          ),
        );
      }
    }

    child.on("message", onMessage);
    child.on("error", onError);
    child.on("exit", onExit);

    child.send(
      buildPromptImagesChildMessage(normalizedItems),
      (error: Error | null) => {
        if (error && !childExited) {
          rejectOnce(error);
        }
      },
    );
  });
}

function buildPromptImagesChildMessage(
  normalizedItems: PromptImageItemLike[],
): PromptImagesChildMessage {
  return {
    normalizedItems,
    downloadConcurrency: PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY,
  };
}

export {
  buildPromptDebugImagesInChild,
  deserializePromptDebugImagesFromIpc,
  serializePromptDebugImagesForIpc,
};
