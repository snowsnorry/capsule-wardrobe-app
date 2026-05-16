import sharp from "sharp";
import { generateImageWithGemini } from "./ai/geminiImage.js";
import { resolveImageLlmProvider } from "./ai/imageLlm.js";
import { generateImageWithOpenAi } from "./ai/openaiImage.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
} from "./ai/promptTemplates.js";
import type { ImageAssetLike } from "./ai/types.js";
import { getProfile } from "./profileStore.js";
import {
  buildWardrobeDerivativeR2ImageKey,
  uploadWardrobeDerivativeImageToR2,
} from "./r2Storage.js";

const CLEANUP_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("./templates/prompt_single_item_image_cleanup.yaml", import.meta.url),
);
const CLEANUP_PROMPT = getPromptTemplateContent(
  CLEANUP_PROMPT_TEMPLATE,
  "user",
);
const THUMBNAIL_WIDTHS = [320, 480, 640] as const;

type GeneratedImageResult = {
  image?: {
    base64?: string | null;
    mimeType?: string | null;
  } | null;
};

type UploadedWardrobeImageCleanupInput = {
  email: string;
  imageUrl: string;
  sourceKey?: string | null;
  sourceBuffer: Buffer | Uint8Array;
  sourceMimeType?: string | null;
  sourceFilename?: string | null;
};

type WardrobeImageCleanupResult = {
  cleanImage: {
    key: string;
    url: string;
    digest: string;
  };
  thumbnails: Array<{
    width: (typeof THUMBNAIL_WIDTHS)[number];
    key: string;
    url: string;
    digest: string;
  }>;
};

function buildSingleItemImageCleanupPrompt() {
  return CLEANUP_PROMPT;
}

function getGeneratedImageBuffer(result: GeneratedImageResult) {
  const base64 = String(result?.image?.base64 || "").trim();
  if (!base64) {
    throw new Error("wardrobe_image_cleanup_missing_output");
  }

  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType: result.image?.mimeType || "image/png",
  };
}

async function buildWardrobeImageThumbnailBuffer(
  imageBuffer: Buffer | Uint8Array,
  width: number,
) {
  return sharp(Buffer.from(imageBuffer), { failOn: "none" })
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
}

async function buildWardrobeImageThumbnailBuffers(
  imageBuffer: Buffer | Uint8Array,
) {
  return Promise.all(
    THUMBNAIL_WIDTHS.map(async (width) => ({
      width,
      buffer: await buildWardrobeImageThumbnailBuffer(imageBuffer, width),
    })),
  );
}

function buildCleanupReferenceImage({
  imageUrl,
  sourceBuffer,
  sourceFilename,
  sourceMimeType,
}: UploadedWardrobeImageCleanupInput): ImageAssetLike {
  return {
    buffer: Buffer.from(sourceBuffer),
    filename: sourceFilename || "uploaded-wardrobe-item.webp",
    imageUrl,
    mimeType: sourceMimeType || "image/webp",
  };
}

async function cleanupUploadedWardrobeItemImage({
  email,
  imageUrl,
  sourceKey = null,
  sourceBuffer,
  sourceFilename = null,
  sourceMimeType = "image/webp",
  getProfileImpl = getProfile,
  generateImageWithGeminiImpl = generateImageWithGemini,
  generateImageWithOpenAiImpl = generateImageWithOpenAi,
  uploadWardrobeDerivativeImageToR2Impl = uploadWardrobeDerivativeImageToR2,
  buildThumbnailBuffersImpl = buildWardrobeImageThumbnailBuffers,
}: UploadedWardrobeImageCleanupInput & {
  getProfileImpl?: typeof getProfile;
  generateImageWithGeminiImpl?: typeof generateImageWithGemini;
  generateImageWithOpenAiImpl?: typeof generateImageWithOpenAi;
  uploadWardrobeDerivativeImageToR2Impl?: typeof uploadWardrobeDerivativeImageToR2;
  buildThumbnailBuffersImpl?: typeof buildWardrobeImageThumbnailBuffers;
}): Promise<WardrobeImageCleanupResult> {
  const userProfile = await getProfileImpl(email);
  const imageLlmResolution = resolveImageLlmProvider(userProfile);
  const generateImageImpl =
    imageLlmResolution.provider === "gemini"
      ? generateImageWithGeminiImpl
      : generateImageWithOpenAiImpl;
  const generationResult = await generateImageImpl(
    buildSingleItemImageCleanupPrompt(),
    {
      images: [
        buildCleanupReferenceImage({
          email,
          imageUrl,
          sourceBuffer,
          sourceFilename,
          sourceKey,
          sourceMimeType,
        }),
      ],
      model: imageLlmResolution.model,
    },
  );
  const generated = getGeneratedImageBuffer(generationResult);
  const cleanKey = buildWardrobeDerivativeR2ImageKey({
    sourceKey,
    sourceUrl: imageUrl,
    suffix: "_clean",
    mimeType: generated.mimeType,
  });
  const cleanImage = await uploadWardrobeDerivativeImageToR2Impl({
    buffer: generated.buffer,
    key: cleanKey,
    mimeType: generated.mimeType,
  });
  const thumbnailBuffers = await buildThumbnailBuffersImpl(generated.buffer);
  const thumbnails = await Promise.all(
    thumbnailBuffers.map(async ({ width, buffer }) => {
      const key = buildWardrobeDerivativeR2ImageKey({
        sourceKey: cleanImage.key,
        suffix: `_${width}`,
        mimeType: "image/webp",
      });
      const uploaded = await uploadWardrobeDerivativeImageToR2Impl({
        buffer,
        key,
        mimeType: "image/webp",
      });

      return {
        width,
        ...uploaded,
      };
    }),
  );

  return {
    cleanImage,
    thumbnails,
  };
}

export {
  THUMBNAIL_WIDTHS,
  buildSingleItemImageCleanupPrompt,
  buildWardrobeImageThumbnailBuffers,
  cleanupUploadedWardrobeItemImage,
};
