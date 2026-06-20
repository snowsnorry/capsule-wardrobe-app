import { readFileSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { t } from "../../shared/i18n/helpers.js";
import { sumImageAssetBytesById } from "./ai/imagePipeline.js";
import {
  BLOCK_RADIUS,
  CONTENT_WIDTH,
  DM_SANS_BOLD_PATH,
  DM_SANS_REGULAR_PATH,
  FALLBACK_BOLD_FONT_CANDIDATES,
  FALLBACK_REGULAR_FONT_CANDIDATES,
  IMAGE_BACKGROUND_COLOR,
  LINK_COLOR,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  loadImageBytes,
  logPdfEvent,
  productNeedsUnicodeFallback,
  resolveFontPath,
} from "./wardrobePdfCore.js";
import {
  addLinkAnnotation,
  drawDetailGroup,
  drawRoundedRect,
  drawTextBlock,
  splitTextIntoLines,
  truncateLines,
} from "./wardrobePdfDrawing.js";
import {
  drawOutfitImageCoverPage,
  drawOutfitReportPages,
  outfitNeedsUnicodeFallback,
} from "./wardrobePdfOutfit.js";
import { capsuleReportNeedsUnicodeFallback } from "./wardrobePdfCapsuleReport.js";
import { drawCapsuleReportPages } from "./wardrobePdfCapsuleReportPages.js";
import { personalItemsReportNeedsUnicodeFallback } from "./wardrobePdfPersonalItemsReport.js";
import { drawPersonalItemsReportPages } from "./wardrobePdfPersonalItemsReportPages.js";
import { getSafeHttpUrl } from "../../shared/urlSecurity.js";
import { translateOption } from "../../shared/i18n/helpers.js";
import { buildProductDetailGroups } from "../../shared/productDetail.js";

async function drawProductPage(
  pdfDoc,
  { product, locale, fonts, imageAssetsById = {}, imageLoadStats = null },
) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const productUrl = getSafeHttpUrl(product?.url);
  const title = product?.name || t("search.untitled", undefined, locale);
  const detailGroups = buildProductDetailGroups(product, {
    t: (key, params) => t(key, params, locale),
    translateOption,
    locale,
  });
  let cursorY = drawProductTitle(pdfDoc, page, {
    title,
    productUrl,
    regularFont: fonts.regularFont,
  });
  cursorY = drawProductTextDetails(page, {
    product,
    locale,
    cursorY,
    regularFont: fonts.regularFont,
  });
  cursorY = drawProductDetailGroups(page, { detailGroups, cursorY, fonts });
  await drawProductImage(pdfDoc, page, {
    product,
    title,
    imageAssetsById,
    imageLoadStats,
    cursorY,
    regularFont: fonts.regularFont,
  });
}

function drawProductTitle(pdfDoc, page, { title, productUrl, regularFont }) {
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  const titleFontSize = 18;
  const titleLineHeight = 22;
  const titleLines = truncateLines(
    splitTextIntoLines(title, regularFont, titleFontSize, CONTENT_WIDTH - 16),
    3,
  );
  const titleHeight = titleLines.length * titleLineHeight;
  let titleY = cursorY;
  for (const line of titleLines) {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y: titleY,
      font: regularFont,
      size: titleFontSize,
      color: LINK_COLOR,
    });
    titleY -= titleLineHeight;
  }

  if (productUrl) {
    let underlineY = cursorY - 2;
    for (const line of titleLines) {
      const lineWidth = regularFont.widthOfTextAtSize(line, titleFontSize);
      page.drawLine({
        start: { x: PAGE_MARGIN, y: underlineY },
        end: { x: PAGE_MARGIN + lineWidth, y: underlineY },
        thickness: 0.8,
        color: LINK_COLOR,
      });
      underlineY -= titleLineHeight;
    }
  }

  if (productUrl) {
    const titleTopY = cursorY + titleFontSize * 0.9;
    const titleBottomY = cursorY - titleHeight + 3;
    addLinkAnnotation(pdfDoc, page, productUrl, {
      x: PAGE_MARGIN,
      y: titleBottomY,
      width: CONTENT_WIDTH,
      height: Math.max(0, titleTopY - titleBottomY),
    });
  }

  cursorY = cursorY - titleHeight;
  return cursorY;
}

function drawProductTextDetails(
  page,
  { product, locale, cursorY, regularFont },
) {
  const category = product?.category
    ? translateOption("categories", product.category, locale)
    : "";
  if (product?.brand) {
    cursorY -= 2;
    cursorY = drawTextBlock(page, product.brand, {
      x: PAGE_MARGIN,
      y: cursorY,
      width: CONTENT_WIDTH,
      font: regularFont,
      size: 12,
      lineHeight: 15,
      maxLines: 2,
    });
  }

  if (category) {
    cursorY -= 2;
    cursorY = drawTextBlock(page, category, {
      x: PAGE_MARGIN,
      y: cursorY,
      width: CONTENT_WIDTH,
      font: regularFont,
      size: 10,
      lineHeight: 12,
      color: rgb(0.43, 0.48, 0.53),
      maxLines: 1,
    });
  }

  if (product?.description) {
    cursorY -= 6;
    cursorY = drawTextBlock(page, product.description, {
      x: PAGE_MARGIN,
      y: cursorY,
      width: CONTENT_WIDTH,
      font: regularFont,
      size: 10,
      lineHeight: 13,
      color: rgb(0.3, 0.33, 0.37),
      maxLines: 8,
    });
  }

  return cursorY - 8;
}

function drawProductDetailGroups(page, { detailGroups, cursorY, fonts }) {
  for (const group of detailGroups) {
    cursorY = drawDetailGroup(page, group, {
      startX: PAGE_MARGIN,
      startY: cursorY,
      width: CONTENT_WIDTH,
      fonts,
    });
  }
  return cursorY;
}

async function drawProductImage(
  pdfDoc,
  page,
  { product, title, imageAssetsById, imageLoadStats, cursorY, regularFont },
) {
  const imageTop = cursorY - 8;
  const imageBounds = {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN,
    width: CONTENT_WIDTH,
    height: Math.max(180, imageTop - PAGE_MARGIN),
  };

  drawRoundedRect(page, {
    x: imageBounds.x,
    y: imageBounds.y,
    width: imageBounds.width,
    height: imageBounds.height,
    radius: BLOCK_RADIUS,
    color: IMAGE_BACKGROUND_COLOR,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });

  const assetKey = String(product?.id || "");
  const imageBytes = await loadImageBytes(
    product?.imageUrl,
    imageAssetsById[assetKey] || null,
    {
      width: (imageBounds.width - 2) * 2,
      height: (imageBounds.height - 2) * 2,
    },
    imageLoadStats,
  );
  if (assetKey && imageAssetsById[assetKey]) {
    delete imageAssetsById[assetKey];
  }
  if (!imageBytes) {
    drawTextBlock(page, title, {
      x: imageBounds.x + 12,
      y: imageBounds.y + imageBounds.height - 20,
      width: imageBounds.width - 24,
      font: regularFont,
      size: 10,
      lineHeight: 12,
      color: rgb(0.43, 0.48, 0.53),
      maxLines: 5,
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
  const imageX = imageBounds.x + (imageBounds.width - scaled.width) / 2;
  const imageY = imageBounds.y + (imageBounds.height - scaled.height) / 2;

  page.drawImage(embeddedImage, {
    x: imageX,
    y: imageY,
    width: scaled.width,
    height: scaled.height,
  });
}

function shouldUseFallbackFonts({
  capsule,
  locale,
  outfit,
  personalItems,
  products,
}) {
  return (
    locale === "ru" ||
    products.some((product) => productNeedsUnicodeFallback(product, locale)) ||
    outfitNeedsUnicodeFallback(outfit, locale) ||
    capsuleReportNeedsUnicodeFallback(capsule, locale) ||
    personalItemsReportNeedsUnicodeFallback(personalItems, locale)
  );
}

export async function buildWardrobePdf(
  products,
  {
    locale = "en",
    capsule = null,
    imageAssetsById = {},
    outfit = null,
    personalItems = null,
    totalStartedAt = null,
  } = {},
) {
  const buildStartedAt = Date.now();
  const imageLoadStats = {
    cachedCount: 0,
    downloadedCount: 0,
  };
  logPdfEvent("build-start", {
    productsTotal: products.length,
    imageAssetBytes: sumImageAssetBytesById(imageAssetsById),
  });
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const useFallbackFonts = shouldUseFallbackFonts({
    capsule,
    locale,
    outfit,
    personalItems,
    products,
  });
  const regularFontBytes = readFileSync(
    useFallbackFonts
      ? resolveFontPath(FALLBACK_REGULAR_FONT_CANDIDATES)
      : DM_SANS_REGULAR_PATH,
  );
  const boldFontBytes = readFileSync(
    useFallbackFonts
      ? resolveFontPath(FALLBACK_BOLD_FONT_CANDIDATES)
      : DM_SANS_BOLD_PATH,
  );
  const regularFont = await pdfDoc.embedFont(regularFontBytes, {
    subset: true,
  });
  const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true });

  await drawOutfitImageCoverPage(pdfDoc, {
    outfit,
    locale,
    fonts: { regularFont, boldFont },
    imageLoadStats,
  });

  for (const product of products) {
    await drawProductPage(pdfDoc, {
      product,
      locale,
      fonts: { regularFont, boldFont },
      imageAssetsById,
      imageLoadStats,
    });
  }

  drawOutfitReportPages(pdfDoc, {
    outfit,
    locale,
    fonts: { regularFont, boldFont },
  });
  drawCapsuleReportPages(pdfDoc, {
    capsule,
    locale,
    fonts: { regularFont, boldFont },
  });
  drawPersonalItemsReportPages(pdfDoc, {
    personalItems,
    locale,
    fonts: { regularFont, boldFont },
    products,
  });

  const buffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  logPdfEvent("build-completed", {
    durationMs: Date.now() - buildStartedAt,
    totalDurationMs: Number.isFinite(totalStartedAt)
      ? Date.now() - totalStartedAt
      : undefined,
    productsTotal: products.length,
    cachedCount: imageLoadStats.cachedCount,
    downloadedCount: imageLoadStats.downloadedCount,
    pdfBytes: buffer.length,
    remainingImageAssetBytes: sumImageAssetBytesById(imageAssetsById),
  });
  return buffer;
}
