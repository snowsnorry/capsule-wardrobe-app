import "dotenv/config";
import { configureSharp } from "./sharpConfig.js";
import {
  buildPromptDebugImages,
  serializePromptDebugImagesForIpc
} from "./promptImages.js";

const PROMPT_CATEGORY_SHARP_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_SHARP_CONCURRENCY || "", 10) || 3;
const PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY || "", 10) || 5;

configureSharp(PROMPT_CATEGORY_SHARP_CONCURRENCY);

function createPromptImagesChildRuntime({
  buildPromptDebugImagesImpl = buildPromptDebugImages,
  serializePromptDebugImagesForIpcImpl = serializePromptDebugImagesForIpc,
  sendImpl = process.send?.bind(process),
  disconnectImpl = process.disconnect?.bind(process),
  exitImpl = (code) => process.exit(code)
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
        normalizedItems: Array.isArray(message?.normalizedItems) ? message.normalizedItems : [],
        saveDebugArtifacts: false
      });

      sendFinalMessage({
        ok: true,
        ...serializePromptDebugImagesForIpcImpl(result)
      }, 0);
    } catch (error) {
      sendFinalMessage({
        ok: false,
        message: error?.message || "unknown_error",
        stack: typeof error?.stack === "string" ? error.stack : null
      }, 1);
    }
  }

  return {
    handleMessage,
    sendFinalMessage
  };
}

const promptImagesChildRuntime = createPromptImagesChildRuntime();

process.once("message", (message) => {
  promptImagesChildRuntime.handleMessage(message);
});

export { createPromptImagesChildRuntime };
