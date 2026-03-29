import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { configureSharp } from "./ai/sharpConfig.js";
import { buildWardrobePdf } from "./wardrobePdf.js";

configureSharp();

function createWardrobePdfChildRuntime({
  mkdirImpl = mkdir,
  writeFileImpl = writeFile,
  buildWardrobePdfImpl = buildWardrobePdf,
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
      const outputFilePath = String(message?.outputFilePath || "").trim();
      if (!outputFilePath) {
        throw new Error("wardrobe_pdf_child_output_path_missing");
      }

      await mkdirImpl(path.dirname(outputFilePath), { recursive: true });
      const pdfBuffer = await buildWardrobePdfImpl(
        Array.isArray(message?.products) ? message.products : [],
        {
          locale: message?.locale || "en",
          totalStartedAt: Number.isFinite(message?.totalStartedAt) ? message.totalStartedAt : null
        }
      );
      await writeFileImpl(outputFilePath, pdfBuffer);

      sendFinalMessage({
        ok: true,
        outputFilePath
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

const wardrobePdfChildRuntime = createWardrobePdfChildRuntime();

process.once("message", (message) => {
  wardrobePdfChildRuntime.handleMessage(message);
});

export { createWardrobePdfChildRuntime };
