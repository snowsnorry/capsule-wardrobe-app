import { fork as nodeFork } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WardrobePdfBuildChildOptions } from "./ai/types.js";
import {
  WARDROBE_PDF_CHILD_TIMEOUT_MS,
  resolveWardrobePdfChildEntryUrl,
  resolveWardrobePdfChildExecArgv,
  type ChildMessage,
  type ProductLike,
  type WardrobePdfForkLike,
} from "./wardrobePdfCore.js";

export async function buildWardrobePdfInChild(
  products: ProductLike[],
  locale = "en",
  {
    forkImpl = nodeFork,
    capsule = null,
    outfit = null,
    personalItems = null,
    totalStartedAt = null,
  }: WardrobePdfBuildChildOptions & { forkImpl?: WardrobePdfForkLike } = {},
) {
  const outputDir = await mkdtemp(
    path.join(os.tmpdir(), "wardrobe-pdf-child-"),
  );
  const outputFilePath = path.join(outputDir, "capsule-wardrobe.pdf");
  const childEntryUrl = resolveWardrobePdfChildEntryUrl();
  const childExecArgv = resolveWardrobePdfChildExecArgv(childEntryUrl);

  try {
    return await runWardrobePdfChildProcess({
      forkImpl,
      childEntryUrl,
      childExecArgv,
      products,
      locale,
      capsule,
      outfit,
      personalItems,
      totalStartedAt,
      outputFilePath,
    });
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runWardrobePdfChildProcess({
  forkImpl,
  childEntryUrl,
  childExecArgv,
  products,
  locale,
  capsule,
  outfit,
  personalItems,
  totalStartedAt,
  outputFilePath,
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = forkImpl(fileURLToPath(childEntryUrl), {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: childExecArgv,
    });
    const state = { settled: false, childExited: false };
    const timeout = createChildTimeout(child, state, reject);

    const cleanup = () =>
      cleanupChildListeners({ child, timeout, onMessage, onError, onExit });
    const rejectOnce = (error) =>
      rejectChildOnce({ state, cleanup, reject, error });
    const resolveFromFile = (filePath) =>
      readChildOutputFile({ filePath, state, cleanup, resolve, reject });
    const onMessage = (message: ChildMessage | null | undefined) =>
      handleChildMessage(message, rejectOnce, resolveFromFile);
    const onError = (error) => rejectOnce(error);
    const onExit = (code, signal) => {
      state.childExited = true;
      if (!state.settled) {
        rejectOnce(
          new Error(
            `wardrobe_pdf_child_exit:${code ?? "null"}:${signal ?? "null"}`,
          ),
        );
      }
    };

    child.on("message", onMessage);
    child.on("error", onError);
    child.on("exit", onExit);
    child.send(
      {
        products,
        locale,
        capsule,
        outfit,
        personalItems,
        totalStartedAt,
        outputFilePath,
      },
      (error) => {
        if (error && !state.childExited) {
          rejectOnce(error);
        }
      },
    );
  });
}

function createChildTimeout(child, state, reject) {
  const timeout = setTimeout(() => {
    state.settled = true;
    child.kill();
    reject(new Error("wardrobe_pdf_child_timeout"));
  }, WARDROBE_PDF_CHILD_TIMEOUT_MS);
  timeout.unref?.();
  return timeout;
}

function cleanupChildListeners({ child, timeout, onMessage, onError, onExit }) {
  clearTimeout(timeout);
  child.removeListener("message", onMessage);
  child.removeListener("error", onError);
  child.removeListener("exit", onExit);
}

async function readChildOutputFile({
  filePath,
  state,
  cleanup,
  resolve,
  reject,
}) {
  try {
    const buffer = await readFile(filePath);
    resolveChildOnce({ state, cleanup, resolve, buffer });
  } catch (error) {
    rejectChildOnce({ state, cleanup, reject, error });
  }
}

function resolveChildOnce({ state, cleanup, resolve, buffer }) {
  if (!state.settled) {
    state.settled = true;
    cleanup();
    resolve(buffer);
  }
}

function rejectChildOnce({ state, cleanup, reject, error }) {
  if (!state.settled) {
    state.settled = true;
    cleanup();
    reject(error);
  }
}

function handleChildMessage(
  message: ChildMessage | null | undefined,
  rejectOnce,
  resolveFromFile,
) {
  if (message?.ok === true) {
    const filePath = String(message?.outputFilePath || "").trim();
    if (filePath) {
      void resolveFromFile(filePath);
    } else {
      rejectOnce(new Error("wardrobe_pdf_child_invalid_payload"));
    }
    return;
  }

  if (message?.ok === false) {
    rejectOnce(getChildPayloadError(message));
  }
}

function getChildPayloadError(
  message: Extract<ChildMessage, { ok: false }>,
): Error {
  const error = new Error(
    String(message?.message || "wardrobe_pdf_child_failed"),
  );
  if (typeof message?.stack === "string" && message.stack.trim().length > 0) {
    error.stack = message.stack;
  }
  return error;
}
