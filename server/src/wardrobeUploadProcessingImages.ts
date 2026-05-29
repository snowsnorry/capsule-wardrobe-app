import { fileTypeFromFile } from "file-type";
import sharp from "sharp";
import { configureSharp } from "./ai/sharpConfig.js";
import {
  cleanupUploadedWardrobeItemImage,
  uploadWardrobeImageThumbnails,
} from "./wardrobeImageCleanup.js";
import { ensureWardrobeImagePortraitCanvas } from "./wardrobeImagePortraitCanvas.js";
import {
  WARDROBE_UPLOAD_BACKGROUND,
  WARDROBE_UPLOAD_IMAGE_MAX_DIMENSION,
  WARDROBE_UPLOAD_WEBP_QUALITY,
  isAllowedWardrobeUploadMimeType,
} from "./wardrobeUploadImagesCore.js";
import {
  type WardrobeUploadProcessingCleanup,
  type WardrobeUploadProcessingInput,
  type WardrobeUploadProcessingSource,
} from "./wardrobeUploadProcessingCore.js";

configureSharp();

type NormalizedImage = {
  buffer: Buffer;
  height: number | null;
  mimeType: "image/webp";
  originalName: string;
  size: number;
  width: number | null;
};

async function normalizeImageBuffer({
  buffer,
  originalName,
}: {
  buffer: Buffer | Uint8Array | string;
  originalName: string;
}): Promise<NormalizedImage> {
  const { data, info } = await sharp(buffer, {
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

  return {
    buffer: data,
    height: Number.isFinite(info.height) ? info.height : null,
    mimeType: "image/webp",
    originalName,
    size: data.length,
    width: Number.isFinite(info.width) ? info.width : null,
  };
}

async function normalizeUploadFile(
  input: Extract<WardrobeUploadProcessingInput, { kind: "file" }>,
) {
  const detectedType = await fileTypeFromFile(input.filePath);
  if (!isAllowedWardrobeUploadMimeType(detectedType?.mime)) {
    throw new Error("invalid_image");
  }

  return normalizeImageBuffer({
    buffer: input.filePath,
    originalName: input.originalName || "wardrobe-image",
  });
}

function buildCleanupProfile(imageLlm: string) {
  return {
    imageLlm,
  };
}

function normalizeCleanupResult(
  cleanup: Awaited<ReturnType<typeof cleanupUploadedWardrobeItemImage>>,
): WardrobeUploadProcessingCleanup {
  return {
    cleanImage: cleanup.cleanImage,
    thumbnails: cleanup.thumbnails.map((thumbnail) => ({
      ...thumbnail,
      width: Number(thumbnail.width),
    })),
  };
}

async function buildFileCleanup({
  email,
  imageLlm,
  normalizedImage,
  source,
}: {
  email: string;
  imageLlm: string;
  normalizedImage: NormalizedImage;
  source: WardrobeUploadProcessingSource;
}) {
  const cleanup = await cleanupUploadedWardrobeItemImage({
    email,
    imageUrl: source.imageUrl,
    sourceBuffer: normalizedImage.buffer,
    sourceFilename: normalizedImage.originalName,
    sourceKey: source.sourceImageKey,
    sourceMimeType: normalizedImage.mimeType,
    getProfileImpl: async () => buildCleanupProfile(imageLlm),
  });
  return normalizeCleanupResult(cleanup);
}

async function buildDirectImageCleanup({
  imageBuffer,
  source,
}: {
  imageBuffer: Buffer | Uint8Array;
  source: WardrobeUploadProcessingSource;
}): Promise<WardrobeUploadProcessingCleanup> {
  const { thumbnails } = await uploadWardrobeImageThumbnails({
    imageBuffer,
    sourceKey: source.sourceImageKey,
    sourceUrl: source.sourceImageUrl,
  });

  return {
    cleanImage: {
      digest: "",
      key: source.sourceImageKey || "",
      url: source.sourceImageUrl || source.imageUrl,
    },
    thumbnails: thumbnails.map((thumbnail) => ({
      ...thumbnail,
      width: Number(thumbnail.width),
    })),
  };
}

async function buildPortraitImageBuffer(image: {
  buffer: Buffer | Uint8Array;
  originalName: string;
}) {
  const normalizedImage = await normalizeImageBuffer({
    buffer: Buffer.from(image.buffer),
    originalName: image.originalName || "wardrobe-image",
  });
  return ensureWardrobeImagePortraitCanvas({
    imageBuffer: normalizedImage.buffer,
    mimeType: normalizedImage.mimeType,
  });
}

export {
  buildCleanupProfile,
  buildDirectImageCleanup,
  buildFileCleanup,
  buildPortraitImageBuffer,
  normalizeCleanupResult,
  normalizeImageBuffer,
  normalizeUploadFile,
};
