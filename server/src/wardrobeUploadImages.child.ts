import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureSharp } from "./ai/sharpConfig.js";
import {
  WARDROBE_UPLOAD_BACKGROUND,
  WARDROBE_UPLOAD_IMAGE_MAX_DIMENSION,
  WARDROBE_UPLOAD_WEBP_QUALITY,
  getWardrobeUploadChildErrorMessage,
  normalizeIpcBuffer,
  type WardrobeUploadChildMessage,
  type WardrobeUploadImageInput,
  type WardrobeUploadNormalizedImage,
} from "./wardrobeUploadImagesCore.js";

configureSharp();

async function normalizeWardrobeUploadImages({
  images,
  outputDir,
}: {
  images: WardrobeUploadImageInput[];
  outputDir: string;
}): Promise<WardrobeUploadNormalizedImage[]> {
  await mkdir(outputDir, { recursive: true });
  const normalized: WardrobeUploadNormalizedImage[] = [];

  for (const [index, image] of images.entries()) {
    const filePath = path.join(outputDir, `wardrobe-upload-${index}.webp`);
    const { data, info } = await sharp(image.buffer, {
      failOn: "none",
      limitInputPixels: 16000000,
    })
      .autoOrient()
      .resize(
        WARDROBE_UPLOAD_IMAGE_MAX_DIMENSION,
        WARDROBE_UPLOAD_IMAGE_MAX_DIMENSION,
        {
          fit: "inside",
          withoutEnlargement: true,
          fastShrinkOnLoad: true,
        },
      )
      .flatten({ background: WARDROBE_UPLOAD_BACKGROUND })
      .webp({ quality: WARDROBE_UPLOAD_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    await writeFile(filePath, data);
    normalized.push({
      filePath,
      mimeType: "image/webp",
      originalName: image.originalName,
      width: Number.isFinite(info.width) ? info.width : null,
      height: Number.isFinite(info.height) ? info.height : null,
      size: data.length,
    });
  }

  return normalized;
}

function getChildPayload(message: WardrobeUploadChildMessage) {
  const outputDir = String(message?.outputDir || "").trim();
  if (!outputDir) {
    throw new Error("wardrobe_upload_output_dir_missing");
  }

  const images = Array.isArray(message?.images)
    ? message.images
        .map((image) => {
          const buffer = normalizeIpcBuffer(image?.buffer);
          return buffer
            ? {
                buffer,
                mimeType: String(image?.mimeType || "image/png"),
                originalName: String(image?.originalName || "wardrobe-image"),
              }
            : null;
        })
        .filter(Boolean)
    : [];

  if (images.length === 0) {
    throw new Error("wardrobe_upload_images_missing");
  }

  return { images, outputDir };
}

function createWardrobeUploadImagesChildRuntime({
  normalizeWardrobeUploadImagesImpl = normalizeWardrobeUploadImages,
  sendImpl = process.send?.bind(process),
  disconnectImpl = process.disconnect?.bind(process),
  exitImpl = (code: number) => {
    process.exit(code);
  },
}: {
  normalizeWardrobeUploadImagesImpl?: typeof normalizeWardrobeUploadImages;
  sendImpl?: ((message: unknown, callback?: () => void) => unknown) | undefined;
  disconnectImpl?: (() => unknown) | undefined;
  exitImpl?: (code: number) => void;
} = {}) {
  let handled = false;

  function sendFinalMessage(message: unknown, exitCode: number) {
    if (!sendImpl) {
      exitImpl(exitCode);
      return;
    }

    sendImpl(message, () => {
      disconnectImpl?.();
      exitImpl(exitCode);
    });
  }

  async function handleMessage(message: WardrobeUploadChildMessage) {
    if (handled) {
      return;
    }
    handled = true;

    try {
      const payload = getChildPayload(message);
      const images = await normalizeWardrobeUploadImagesImpl(payload);
      sendFinalMessage({ ok: true, images }, 0);
    } catch (error) {
      sendFinalMessage(getWardrobeUploadChildErrorMessage(error), 1);
    }
  }

  return { handleMessage, sendFinalMessage };
}

const wardrobeUploadImagesChildRuntime =
  createWardrobeUploadImagesChildRuntime();

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.once("message", (message) => {
    void wardrobeUploadImagesChildRuntime.handleMessage(
      message as WardrobeUploadChildMessage,
    );
  });
}

export {
  createWardrobeUploadImagesChildRuntime,
  normalizeWardrobeUploadImages,
};
