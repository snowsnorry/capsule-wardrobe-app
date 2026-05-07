import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureSharp } from "./sharpConfig.js";
import {
  buildPromptDebugImages,
  serializePromptDebugImagesForIpc,
} from "./promptImages.js";

const PROMPT_CATEGORY_SHARP_CONCURRENCY =
  Number.parseInt(process.env.PROMPT_CATEGORY_SHARP_CONCURRENCY || "", 10) || 3;

configureSharp(PROMPT_CATEGORY_SHARP_CONCURRENCY);

function createPromptImagesChildRuntime({
  buildPromptDebugImagesImpl = buildPromptDebugImages as (input?: {
    normalizedItems?: unknown[];
    debugOutputDir?: string | URL;
    saveDebugArtifacts?: boolean;
  }) => Promise<unknown>,
  serializePromptDebugImagesForIpcImpl = serializePromptDebugImagesForIpc as (
    result?: unknown,
  ) => unknown,
  sendImpl = process.send?.bind(process),
  disconnectImpl = process.disconnect?.bind(process),
  exitImpl = (code: number) => {
    process.exit(code);
  },
}: {
  buildPromptDebugImagesImpl?: (input?: {
    normalizedItems?: unknown[];
    debugOutputDir?: string | URL;
    saveDebugArtifacts?: boolean;
  }) => Promise<unknown>;
  serializePromptDebugImagesForIpcImpl?: (result?: unknown) => unknown;
  sendImpl?: ((message: unknown, callback?: () => void) => unknown) | undefined;
  disconnectImpl?: (() => unknown) | undefined;
  exitImpl?: (code: number) => void;
} = {}) {
  let handled = false;

  function sendFinalMessage(message, exitCode) {
    if (!sendImpl) {
      exitImpl(exitCode);
      return;
    }

    sendImpl(message, () => {
      disconnectImpl?.();
      exitImpl(exitCode);
    });
  }

  async function handleMessage(message) {
    if (handled) {
      return;
    }
    handled = true;

    try {
      const result = await buildPromptDebugImagesImpl({
        normalizedItems: Array.isArray(message?.normalizedItems)
          ? message.normalizedItems
          : [],
        saveDebugArtifacts: false,
      });

      const serialized = serializePromptDebugImagesForIpcImpl(result);
      sendFinalMessage(
        {
          ok: true,
          ...(serialized && typeof serialized === "object" ? serialized : {}),
        },
        0,
      );
    } catch (error) {
      sendFinalMessage(
        {
          ok: false,
          message: error?.message || "unknown_error",
          stack: typeof error?.stack === "string" ? error.stack : null,
        },
        1,
      );
    }
  }

  return {
    handleMessage,
    sendFinalMessage,
  };
}

const promptImagesChildRuntime = createPromptImagesChildRuntime();

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.once("message", (message) => {
    promptImagesChildRuntime.handleMessage(message);
  });
}

export { createPromptImagesChildRuntime };
