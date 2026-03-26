import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { configureSharp } from "./ai/sharpConfig.js";
import { buildWardrobePdf } from "./wardrobePdf.js";

configureSharp();

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
    const outputFilePath = String(message?.outputFilePath || "").trim();
    if (!outputFilePath) {
      throw new Error("wardrobe_pdf_child_output_path_missing");
    }

    await mkdir(path.dirname(outputFilePath), { recursive: true });
    const pdfBuffer = await buildWardrobePdf(
      Array.isArray(message?.products) ? message.products : [],
      {
        locale: message?.locale || "en",
        totalStartedAt: Number.isFinite(message?.totalStartedAt) ? message.totalStartedAt : null
      }
    );
    await writeFile(outputFilePath, pdfBuffer);

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

process.once("message", (message) => {
  handleMessage(message);
});
