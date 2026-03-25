import "dotenv/config";
import { configureSharp } from "./sharpConfig.js";
import {
  buildPromptDebugImagesForCategory,
  serializePromptDebugImagesForIpc
} from "./promptImages.js";

const PROMPT_CATEGORY_SHARP_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_SHARP_CONCURRENCY || "", 10) || 3;
const PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY = Number.parseInt(process.env.PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY || "", 10) || 5;

configureSharp(PROMPT_CATEGORY_SHARP_CONCURRENCY);

let handled = false;

function sendFinalMessage(message, exitCode) {
  if (!process.send) {
    process.exit(exitCode);
    return;
  }

  process.send(message, () => {
    process.disconnect?.();
    process.exit(exitCode);
  });
}

async function handleMessage(message) {
  if (handled) {
    return;
  }
  handled = true;

  try {
    const result = await buildPromptDebugImagesForCategory({
      category: message?.category ?? "",
      items: Array.isArray(message?.items) ? message.items : [],
      downloadConcurrency: Number.isInteger(message?.downloadConcurrency) && message.downloadConcurrency > 0
        ? message.downloadConcurrency
        : PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY
    });

    sendFinalMessage({
      ok: true,
      ...serializePromptDebugImagesForIpc({
        categories: [result.category],
        downloadedCount: result.downloadedCount,
        skippedCount: result.skippedCount
      })
    }, 0);
  } catch (error) {
    sendFinalMessage({
      ok: false,
      message: error?.message || "unknown_error",
      stack: typeof error?.stack === "string" ? error.stack : null
    }, 1);
  }
}

process.once("message", (message) => {
  handleMessage(message);
});
