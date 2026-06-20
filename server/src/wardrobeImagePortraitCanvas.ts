import sharp from "sharp";
import {
  WARDROBE_UPLOAD_BACKGROUND,
  WARDROBE_UPLOAD_WEBP_QUALITY,
} from "./wardrobeUploadImagesCore.js";

const WARDROBE_PORTRAIT_CANVAS_WIDTH = 1200;
const WARDROBE_PORTRAIT_CANVAS_HEIGHT = 1600;

type WardrobePortraitCanvasResult = {
  buffer: Buffer;
  changed: boolean;
  mimeType: string;
};

function isThreeByFour(width: number | undefined, height: number | undefined) {
  if (!width || !height) {
    return false;
  }

  return width * 4 === height * 3;
}

function encodePortraitCanvasImage(
  image: ReturnType<typeof sharp>,
  mimeType: string | null | undefined,
) {
  if (mimeType === "image/webp") {
    return image.webp({ quality: WARDROBE_UPLOAD_WEBP_QUALITY });
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return image.jpeg({ quality: 90 });
  }

  return image.png();
}

async function ensureWardrobeImagePortraitCanvas({
  imageBuffer,
  mimeType = "image/png",
}: {
  imageBuffer: Buffer | Uint8Array;
  mimeType?: string | null;
}): Promise<WardrobePortraitCanvasResult> {
  const buffer = Buffer.from(imageBuffer);
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  if (isThreeByFour(metadata.width, metadata.height)) {
    return {
      buffer,
      changed: false,
      mimeType: mimeType || "image/png",
    };
  }

  const image = sharp(buffer, { failOn: "none" })
    .autoOrient()
    .resize(WARDROBE_PORTRAIT_CANVAS_WIDTH, WARDROBE_PORTRAIT_CANVAS_HEIGHT, {
      fit: "contain",
      withoutEnlargement: true,
      background: WARDROBE_UPLOAD_BACKGROUND,
    })
    .flatten({ background: WARDROBE_UPLOAD_BACKGROUND });

  return {
    buffer: await encodePortraitCanvasImage(image, mimeType).toBuffer(),
    changed: true,
    mimeType: mimeType || "image/png",
  };
}

export {
  WARDROBE_PORTRAIT_CANVAS_HEIGHT,
  WARDROBE_PORTRAIT_CANVAS_WIDTH,
  ensureWardrobeImagePortraitCanvas,
};
