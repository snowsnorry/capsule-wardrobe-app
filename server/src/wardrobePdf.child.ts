import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureSharp } from "./ai/sharpConfig.js";
import { buildWardrobePdf } from "./wardrobePdf.js";

configureSharp();

function createWardrobePdfChildRuntime({
  mkdirImpl = mkdir as (
    path: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>,
  writeFileImpl = writeFile as (
    path: string,
    buffer: Buffer,
  ) => Promise<unknown>,
  buildWardrobePdfImpl = buildWardrobePdf as (
    products: unknown[],
    options?: {
      locale?: string;
      outfit?: Record<string, unknown> | null;
      totalStartedAt?: number | null;
    },
  ) => Promise<Buffer>,
  sendImpl = process.send?.bind(process),
  disconnectImpl = process.disconnect?.bind(process),
  exitImpl = (code: number) => {
    process.exit(code);
  },
}: {
  mkdirImpl?: (
    path: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  writeFileImpl?: (path: string, buffer: Buffer) => Promise<unknown>;
  buildWardrobePdfImpl?: (
    products: unknown[],
    options?: {
      locale?: string;
      outfit?: Record<string, unknown> | null;
      totalStartedAt?: number | null;
    },
  ) => Promise<Buffer>;
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
      const payload = getWardrobePdfChildPayload(message);
      const { outputFilePath } = payload;
      await mkdirImpl(path.dirname(outputFilePath), { recursive: true });
      const pdfBuffer = await buildWardrobePdfImpl(
        payload.products,
        payload.options,
      );
      await writeFileImpl(outputFilePath, pdfBuffer);
      sendFinalMessage({ ok: true, outputFilePath }, 0);
    } catch (error) {
      sendFinalMessage(getWardrobePdfChildErrorMessage(error), 1);
    }
  }

  return {
    handleMessage,
    sendFinalMessage,
  };
}

function getWardrobePdfChildPayload(message) {
  const outputFilePath = String(message?.outputFilePath || "").trim();
  if (!outputFilePath) {
    throw new Error("wardrobe_pdf_child_output_path_missing");
  }

  return {
    outputFilePath,
    products: Array.isArray(message?.products) ? message.products : [],
    options: {
      locale: message?.locale || "en",
      outfit: normalizeOutfitPdfOptions(message?.outfit),
      totalStartedAt: Number.isFinite(message?.totalStartedAt)
        ? message.totalStartedAt
        : null,
    },
  };
}

function normalizeOutfitPdfOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const report =
    value.report &&
    typeof value.report === "object" &&
    !Array.isArray(value.report)
      ? value.report
      : null;

  return {
    title: typeof value.title === "string" ? value.title : null,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : null,
    imageStale: Boolean(value.imageStale),
    report,
    reportStale: Boolean(value.reportStale),
  };
}

function getWardrobePdfChildErrorMessage(error) {
  return {
    ok: false,
    message: error?.message || "unknown_error",
    stack: typeof error?.stack === "string" ? error.stack : null,
  };
}

const wardrobePdfChildRuntime = createWardrobePdfChildRuntime();

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.once("message", (message) => {
    wardrobePdfChildRuntime.handleMessage(message);
  });
}

export { createWardrobePdfChildRuntime };
