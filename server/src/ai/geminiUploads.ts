import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logWarn } from "../logger.js";
import type { ImageAssetLike } from "./types.js";
import type {
  GeminiClientLike,
  GeminiUploadedFileLike,
} from "./geminiTypes.js";

function getMimeType(image: ImageAssetLike) {
  return typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
    ? image.mimeType.trim()
    : "image/jpeg";
}

function getTempFileExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
    case "image/jpg":
    default:
      return ".jpg";
  }
}

function getGeminiDisplayName(image: ImageAssetLike) {
  return typeof image?.filename === "string" && image.filename.trim().length > 0
    ? image.filename.trim()
    : undefined;
}

function logSkippedGeminiImage(image: ImageAssetLike) {
  logWarn("ai.gemini.image.skipped", {
    category: image?.category ?? null,
    filename: image?.filename ?? null,
    reason: "missing_buffer",
  });
}

async function uploadBufferToGemini(
  client: Pick<GeminiClientLike, "files">,
  image: ImageAssetLike,
  {
    writeFileSyncImpl = writeFileSync,
    unlinkSyncImpl = unlinkSync,
    tmpdirImpl = tmpdir,
    joinImpl = join,
    randomUUIDImpl = randomUUID,
  }: {
    writeFileSyncImpl?: (path: string, data: Buffer) => void;
    unlinkSyncImpl?: (path: string) => void;
    tmpdirImpl?: () => string;
    joinImpl?: (...parts: string[]) => string;
    randomUUIDImpl?: () => string;
  } = {},
) {
  const buffer = image?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    logSkippedGeminiImage(image);
    return null;
  }

  const mimeType = getMimeType(image);
  const tempFilePath = joinImpl(
    tmpdirImpl(),
    `${randomUUIDImpl()}${getTempFileExtension(mimeType)}`,
  );

  try {
    writeFileSyncImpl(tempFilePath, buffer);
    return await client.files.upload({
      file: tempFilePath,
      config: {
        mimeType,
        displayName: getGeminiDisplayName(image),
      },
    });
  } finally {
    try {
      unlinkSyncImpl(tempFilePath);
    } catch {
      // Ignore cleanup failures for local temp files.
    }
  }
}

async function uploadImagesToGemini(
  client: Pick<GeminiClientLike, "files">,
  images: ImageAssetLike[],
  uploadBufferToGeminiImpl: typeof uploadBufferToGemini,
) {
  const uploadedFiles: GeminiUploadedFileLike[] = [];

  for (const image of images || []) {
    const uploadedFile = await uploadBufferToGeminiImpl(client, image);
    if (uploadedFile) {
      uploadedFiles.push(uploadedFile);
    }
  }

  return uploadedFiles;
}

async function cleanupUploadedGeminiFiles(
  client: Pick<GeminiClientLike, "files">,
  uploadedFiles: GeminiUploadedFileLike[] = [],
) {
  for (const uploadedFile of uploadedFiles) {
    const name =
      typeof uploadedFile?.name === "string" ? uploadedFile.name.trim() : "";
    if (!name) {
      continue;
    }

    try {
      await client.files.delete({ name });
    } catch (error) {
      logWarn("ai.gemini.file.delete.failed", {
        name,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }
}

export {
  cleanupUploadedGeminiFiles,
  uploadBufferToGemini,
  uploadImagesToGemini,
};
