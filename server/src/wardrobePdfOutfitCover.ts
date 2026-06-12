import { t } from "../../shared/i18n/helpers.js";
import {
  BLOCK_RADIUS,
  CONTENT_WIDTH,
  IMAGE_BACKGROUND_COLOR,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  loadImageBytes,
} from "./wardrobePdfCore.js";
import { drawRoundedRect } from "./wardrobePdfDrawing.js";
import {
  BORDER_COLOR,
  INK_COLOR,
  SECONDARY_COLOR,
} from "./wardrobePdfOutfitConstants.js";
import {
  drawStaleBanner,
  drawWrappedText,
} from "./wardrobePdfOutfitDrawing.js";

export async function drawOutfitImageCoverPage(
  pdfDoc,
  { fonts, imageLoadStats, locale, outfit },
) {
  if (!outfit?.imageUrl) {
    return;
  }

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const title = outfit.title || t("wardrobe.newOutfit", undefined, locale);
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  cursorY = drawWrappedText(page, title, {
    x: PAGE_MARGIN,
    y: cursorY,
    maxWidth: CONTENT_WIDTH,
    font: fonts.boldFont,
    size: 26,
    lineHeight: 31,
    color: INK_COLOR,
  });

  cursorY -= 10;
  if (outfit.imageStale) {
    cursorY = drawStaleBanner(page, {
      x: PAGE_MARGIN,
      y: cursorY,
      width: CONTENT_WIDTH,
      font: fonts.regularFont,
      label: t("capsule.outfitSetImageObsolete", undefined, locale),
    });
  }

  const imageBounds = {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN,
    width: CONTENT_WIDTH,
    height: Math.max(240, cursorY - PAGE_MARGIN - 8),
  };
  drawRoundedRect(page, {
    ...imageBounds,
    radius: BLOCK_RADIUS,
    color: IMAGE_BACKGROUND_COLOR,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  const imageBytes = await loadImageBytes(
    outfit.imageUrl,
    null,
    {
      width: imageBounds.width * 2,
      height: imageBounds.height * 2,
    },
    imageLoadStats,
  );
  if (!imageBytes) {
    drawWrappedText(page, title, {
      x: imageBounds.x + 16,
      y: imageBounds.y + imageBounds.height - 24,
      maxWidth: imageBounds.width - 32,
      font: fonts.regularFont,
      size: 11,
      lineHeight: 14,
      color: SECONDARY_COLOR,
    });
    return;
  }

  const embeddedImage =
    imageBytes.kind === "jpg"
      ? await pdfDoc.embedJpg(imageBytes.bytes)
      : await pdfDoc.embedPng(imageBytes.bytes);
  const scaled = embeddedImage.scaleToFit(
    imageBounds.width - 2,
    imageBounds.height - 2,
  );
  page.drawImage(embeddedImage, {
    x: imageBounds.x + (imageBounds.width - scaled.width) / 2,
    y: imageBounds.y + (imageBounds.height - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height,
  });
}
