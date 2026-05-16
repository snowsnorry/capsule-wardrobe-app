import { fork as nodeFork } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WARDROBE_UPLOAD_CHILD_TIMEOUT_MS,
  resolveWardrobeUploadChildEntryUrl,
  resolveWardrobeUploadChildExecArgv,
  type WardrobeUploadChildPayload,
  type WardrobeUploadForkLike,
  type WardrobeUploadImageInput,
} from "./wardrobeUploadImagesCore.js";

type NormalizedWardrobeUploadImage = {
  buffer: Buffer;
  mimeType: "image/webp";
  originalName: string;
  width: number | null;
  height: number | null;
  size: number;
};

async function normalizeWardrobeUploadImagesInChild(
  images: WardrobeUploadImageInput[],
  { forkImpl = nodeFork }: { forkImpl?: WardrobeUploadForkLike } = {},
): Promise<NormalizedWardrobeUploadImage[]> {
  const outputDir = await mkdtemp(
    path.join(os.tmpdir(), "wardrobe-upload-child-"),
  );

  try {
    const childImages = await runWardrobeUploadChildProcess({
      forkImpl,
      images,
      outputDir,
    });
    return Promise.all(
      childImages.map(async (image) => ({
        buffer: await readFile(image.filePath),
        mimeType: image.mimeType,
        originalName: image.originalName,
        width: image.width,
        height: image.height,
        size: image.size,
      })),
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runWardrobeUploadChildProcess({
  forkImpl,
  images,
  outputDir,
}: {
  forkImpl: WardrobeUploadForkLike;
  images: WardrobeUploadImageInput[];
  outputDir: string;
}) {
  return new Promise<
    Array<{
      filePath: string;
      mimeType: "image/webp";
      originalName: string;
      width: number | null;
      height: number | null;
      size: number;
    }>
  >((resolve, reject) => {
    const childEntryUrl = resolveWardrobeUploadChildEntryUrl();
    const child = forkImpl(fileURLToPath(childEntryUrl), {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: resolveWardrobeUploadChildExecArgv(childEntryUrl),
    });
    const state = { settled: false, childExited: false };
    const timeout = setTimeout(() => {
      state.settled = true;
      cleanup();
      child.kill();
      reject(new Error("wardrobe_upload_child_timeout"));
    }, WARDROBE_UPLOAD_CHILD_TIMEOUT_MS);
    timeout.unref?.();

    const cleanup = () => {
      clearTimeout(timeout);
      child.removeListener("message", onMessage);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
    };
    const resolveOnce = (
      value: Awaited<ReturnType<typeof validatePayload>>,
    ) => {
      if (state.settled) return;
      state.settled = true;
      cleanup();
      resolve(value);
    };
    const rejectOnce = (error: Error) => {
      if (state.settled) return;
      state.settled = true;
      cleanup();
      reject(error);
    };
    const onMessage = (message: WardrobeUploadChildPayload) => {
      if (message?.ok === true) {
        try {
          resolveOnce(validatePayload(message));
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }

      if (message?.ok === false) {
        rejectOnce(getChildPayloadError(message));
      }
    };
    const onError = (error: Error) => rejectOnce(error);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      state.childExited = true;
      if (!state.settled) {
        rejectOnce(
          new Error(
            `wardrobe_upload_child_exit:${code ?? "null"}:${signal ?? "null"}`,
          ),
        );
      }
    };

    child.on("message", onMessage);
    child.on("error", onError);
    child.on("exit", onExit);
    child.send({ images, outputDir }, (error: Error | null) => {
      if (error && !state.childExited) {
        rejectOnce(error);
      }
    });
  });
}

function validatePayload(
  message: Extract<WardrobeUploadChildPayload, { ok: true }>,
) {
  if (!Array.isArray(message.images) || message.images.length === 0) {
    throw new Error("wardrobe_upload_child_invalid_payload");
  }

  return message.images.map((image) => {
    const filePath = String(image?.filePath || "").trim();
    if (!filePath) {
      throw new Error("wardrobe_upload_child_invalid_payload");
    }

    return {
      filePath,
      mimeType: "image/webp" as const,
      originalName: String(image?.originalName || "wardrobe-image"),
      width: Number.isFinite(image?.width) ? Number(image.width) : null,
      height: Number.isFinite(image?.height) ? Number(image.height) : null,
      size: Number.isFinite(image?.size) ? Number(image.size) : 0,
    };
  });
}

function getChildPayloadError(
  message: Extract<WardrobeUploadChildPayload, { ok: false }>,
): Error {
  const error = new Error(
    String(message?.message || "wardrobe_upload_child_failed"),
  );
  if (typeof message?.stack === "string" && message.stack.trim().length > 0) {
    error.stack = message.stack;
  }
  return error;
}

export { normalizeWardrobeUploadImagesInChild };
