import sharp from "sharp";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";
import type {
  PromptImageAsset
} from "./types.js";
import {
  BACKGROUND_COLOR,
  PDF_IMAGE_JPEG_QUALITY,
  createSharpPipeline,
  getMetadataDimensions,
  mapWithConcurrency
} from "./promptImagesShared.js";

async function preparePdfImageAsset(
  imageAsset: PromptImageAsset | null | undefined,
  { width, height }: { width?: number; height?: number } = {}
) {
  if (!imageAsset?.buffer) {
    return null;
  }

  const targetWidth = Math.max(1, Math.round(Number(width) || 1));
  const targetHeight = Math.max(1, Math.round(Number(height) || 1));
  const buffer = await createSharpPipeline(imageAsset.buffer)
    .resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
      background: BACKGROUND_COLOR
    })
    .flatten({ background: BACKGROUND_COLOR })
    .jpeg({
      quality: PDF_IMAGE_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true
    })
    .toBuffer();

  const metadata = await sharp(buffer).metadata().catch(() => ({}));
  const dimensions = getMetadataDimensions(metadata);

  return {
    buffer,
    mimeType: "image/jpeg",
    kind: "jpg",
    preparedForPdf: true,
    imageUrl: imageAsset.imageUrl || "",
    width: dimensions.width,
    height: dimensions.height
  };
}

async function preparePdfImageAssets(
  imageAssetsById: Record<string, PromptImageAsset> = {},
  targetSize?: { width?: number; height?: number }
) {
  const entries = Object.entries(imageAssetsById).filter(([, asset]) => Boolean(asset?.buffer));
  const preparedEntries = await mapWithConcurrency(entries, IMAGE_DOWNLOAD_CONCURRENCY, async ([id, asset]) => {
    const prepared = await preparePdfImageAsset(asset, targetSize);
    return prepared ? [id, prepared] : null;
  });

  return Object.fromEntries(preparedEntries.filter(Boolean));
}

export { preparePdfImageAsset, preparePdfImageAssets };
