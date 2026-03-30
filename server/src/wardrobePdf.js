import { existsSync, readFileSync } from "node:fs";
import { fork as nodeFork } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { getProfile, getProfilePdf, getProfileWithPdf, updateProfilePdf } from "./profileStore.js";
import { getProductsByUrlsInOrder } from "./db.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";
import { buildProductDetailGroups } from "../../shared/productDetail.js";
import { isSupportedLocale, normalizeLocale, t, translateOption } from "../../shared/i18n/helpers.js";
import {
  runWithImageWorkSlot,
  sumImageAssetBytesById
} from "./ai/imagePipeline.js";
import { readImageFromLocalCache, resolveSourceImageUrl } from "./ai/promptImages.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
const BOX_PADDING = 13;
const BLOCK_RADIUS = 16.5;
const LINK_COLOR = rgb(0.56, 0.44, 0.27);
const SUBTLE_BLOCK_COLOR = rgb(0.96, 0.965, 0.972);
const IMAGE_BACKGROUND_COLOR = rgb(0.97, 0.96, 0.94);
const COLOR_SWATCH_STYLES = {
  black: { fill: rgb(0.12, 0.16, 0.2) },
  white: { fill: rgb(0.972, 0.961, 0.937) },
  grey: { fill: rgb(0.58, 0.64, 0.72) },
  beige: { fill: rgb(0.839, 0.757, 0.639) },
  brown: { fill: rgb(0.545, 0.369, 0.235) },
  blue: { fill: rgb(0.31, 0.514, 0.8) },
  green: { fill: rgb(0.302, 0.545, 0.333) },
  red: { fill: rgb(0.784, 0.298, 0.298) },
  pink: { fill: rgb(0.847, 0.541, 0.651) },
  yellow: { fill: rgb(0.851, 0.706, 0.231) },
  purple: { fill: rgb(0.541, 0.373, 0.749) },
  orange: { fill: rgb(0.851, 0.478, 0.169) },
  metallic: { fill: rgb(0.741, 0.765, 0.804) },
  multicolor: { fill: rgb(0.31, 0.514, 0.8) }
};
const require = createRequire(import.meta.url);
const DM_SANS_REGULAR_PATH = require.resolve("@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff");
const DM_SANS_BOLD_PATH = require.resolve("@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff");
const FALLBACK_REGULAR_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf"
];
const FALLBACK_BOLD_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"
];
const WARDROBE_PDF_POLL_AFTER_MS = 2000;
const PDF_JOB_TTL_MS = 5 * 60 * 1000;
const wardrobePdfJobs = new Map();
const DEFAULT_PDF_IMAGE_TARGET_SIZE = {
  width: Math.round((CONTENT_WIDTH - 2) * 2),
  height: Math.round((PAGE_HEIGHT - (PAGE_MARGIN * 2)) * 2)
};
const WARDROBE_PDF_CHILD_TIMEOUT_MS = Number.parseInt(process.env.WARDROBE_PDF_CHILD_TIMEOUT_MS || "", 10) || 180000;
const WARDROBE_PDF_CHILD_PATH = new URL("./wardrobePdf.child.js", import.meta.url);

function formatLogValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatLogPayload(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${formatLogValue(value)}`)
    .join(", ");
}

function logPdfEvent(event, payload = {}) {
  const message = formatLogPayload(payload);

  if (message) {
    console.info(`[wardrobe-pdf][${event}] ${message}`);
    return;
  }

  console.info(`[wardrobe-pdf][${event}]`);
}

function resolveFontPath(candidates) {
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`font_not_found:${candidates[0]}`);
  }
  return match;
}

function hasNonLatinText(value) {
  return /[^\u0000-\u024f]/.test(String(value || ""));
}

function productNeedsUnicodeFallback(product, locale) {
  if (locale === "ru") {
    return true;
  }

  return [
    product?.name,
    product?.brand,
    product?.description,
    product?.url
  ].some(hasNonLatinText);
}

function getStoredWardrobeItems(profile) {
  const stored = profile?.items;

  if (Array.isArray(stored)) {
    return stored;
  }

  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return [];
  }

  return Array.isArray(stored.items) ? stored.items : [];
}

function createWardrobePdfGenerationKey({ items = [], locale = "en" } = {}) {
  return JSON.stringify({
    locale,
    items: sortWardrobeItems(items).map((item) => String(item?.url || item?.id || `${item?.category}:${item?.name}`))
  });
}

function normalizeStoredPdf(pdf) {
  if (!pdf) {
    return null;
  }

  if (Buffer.isBuffer(pdf)) {
    return pdf;
  }

  if (pdf instanceof Uint8Array) {
    return Buffer.from(pdf);
  }

  if (Array.isArray(pdf)) {
    return Buffer.from(pdf);
  }

  return null;
}

function getPdfLocale(rawLocale) {
  const locale = normalizeLocale(String(rawLocale || ""));
  return isSupportedLocale(locale) ? locale : "en";
}

async function normalizeImageBytes(buffer, mimeType = "") {
  if (!buffer) {
    return null;
  }

  const contentType = String(mimeType || "").toLowerCase();
  const sourceBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return { kind: "jpg", bytes: sourceBuffer };
  }

  if (contentType.includes("png")) {
    return { kind: "png", bytes: sourceBuffer };
  }

  const pngBuffer = await sharp(sourceBuffer).png().toBuffer();
  return { kind: "png", bytes: pngBuffer };
}

async function preparePdfImageBytes(buffer, mimeType = "", { width, height, autoRotate = true } = {}) {
  if (!buffer) {
    return null;
  }

  const sourceBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const targetWidth = Math.max(1, Math.round(Number(width) || 1));
  const targetHeight = Math.max(1, Math.round(Number(height) || 1));
  const image = sharp(sourceBuffer, { failOn: "none" });
  if (autoRotate) {
    image.rotate();
  }
  const metadata = await image.metadata().catch(() => ({}));
  const hasAlpha = metadata?.hasAlpha === true || String(mimeType || "").toLowerCase().includes("png");

  const resized = image.resize(targetWidth, targetHeight, {
    fit: "inside",
    withoutEnlargement: true
  });

  if (hasAlpha) {
    const pngBuffer = await resized.png({
      compressionLevel: 9,
      palette: true,
      quality: 80
    }).toBuffer();
    return { kind: "png", bytes: pngBuffer };
  }

  const jpgBuffer = await resized.flatten({ background: "#f7f4ef" }).jpeg({
    quality: 76,
    mozjpeg: true,
    progressive: true
  }).toBuffer();
  return { kind: "jpg", bytes: jpgBuffer };
}

async function loadImageBytes(imageUrl, imageAsset = null, targetSize = null, imageLoadStats = null) {
  const stats = imageLoadStats || { cachedCount: 0, downloadedCount: 0 };
  const resolvedImageUrl = resolveSourceImageUrl(imageUrl);

  if (imageAsset?.buffer) {
    if (imageAsset.preparedForPdf && imageAsset.kind === "jpg") {
      return { kind: "jpg", bytes: imageAsset.buffer };
    }

    if (targetSize) {
      return preparePdfImageBytes(imageAsset.buffer, imageAsset.mimeType, targetSize);
    }
    return normalizeImageBytes(imageAsset.buffer, imageAsset.mimeType);
  }

  if (typeof resolvedImageUrl !== "string" || resolvedImageUrl.trim().length === 0) {
    return null;
  }

  try {
    const cachedImage = await readImageFromLocalCache(imageUrl);
    if (cachedImage?.buffer) {
      stats.cachedCount += 1;
      return normalizeImageBytes(cachedImage.buffer, cachedImage.mimeType);
    }

    const response = await fetch(resolvedImageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`image_fetch_failed_${response.status}`);
    }

    stats.downloadedCount += 1;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    if (targetSize) {
      return preparePdfImageBytes(sourceBuffer, contentType, targetSize);
    }
    return normalizeImageBytes(sourceBuffer, contentType);
  } catch (error) {
    console.error("[wardrobe-pdf][image]", resolvedImageUrl, error);
    return null;
  }
}

function splitTextIntoLines(text, font, fontSize, maxWidth) {
  const rawWords = String(text || "").split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) {
    return [];
  }

  const words = [];
  for (const rawWord of rawWords) {
    if (font.widthOfTextAtSize(rawWord, fontSize) <= maxWidth) {
      words.push(rawWord);
      continue;
    }

    let chunk = "";
    for (const char of rawWord) {
      const candidate = `${chunk}${char}`;
      if (chunk && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
        words.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }

    if (chunk) {
      words.push(chunk);
    }
  }

  const lines = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${currentLine} ${words[index]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = words[index];
  }

  lines.push(currentLine);
  return lines;
}

function truncateLines(lines, maxLines) {
  if (lines.length <= maxLines) {
    return lines;
  }

  const truncated = lines.slice(0, maxLines);
  const lastLine = truncated[maxLines - 1] || "";
  truncated[maxLines - 1] = lastLine.replace(/[.,;:!?-]?\s*$/, "") + "...";
  return truncated;
}

function drawRoundedRect(page, { x, y, width, height, radius, color, borderColor, borderWidth = 0 }) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));

  if (borderColor && borderWidth > 0) {
    drawRoundedRect(page, {
      x,
      y,
      width,
      height,
      radius: r,
      color: borderColor
    });
    drawRoundedRect(page, {
      x: x + borderWidth,
      y: y + borderWidth,
      width: Math.max(0, width - borderWidth * 2),
      height: Math.max(0, height - borderWidth * 2),
      radius: Math.max(0, r - borderWidth),
      color
    });
    return;
  }

  page.drawRectangle({
    x: x + r,
    y,
    width: Math.max(0, width - r * 2),
    height,
    color
  });
  page.drawRectangle({
    x,
    y: y + r,
    width,
    height: Math.max(0, height - r * 2),
    color
  });
  page.drawCircle({
    x: x + r,
    y: y + r,
    size: r,
    color
  });
  page.drawCircle({
    x: x + width - r,
    y: y + r,
    size: r,
    color
  });
  page.drawCircle({
    x: x + r,
    y: y + height - r,
    size: r,
    color
  });
  page.drawCircle({
    x: x + width - r,
    y: y + height - r,
    size: r,
    color
  });
}

function addLinkAnnotation(pdfDoc, page, url, rect) {
  if (!url) {
    return;
  }

  const annotation = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: url
    }
  });
  const annotationRef = pdfDoc.context.register(annotation);
  const annots = page.node.Annots();
  if (annots) {
    annots.push(annotationRef);
  } else {
    page.node.set("Annots", pdfDoc.context.obj([annotationRef]));
  }
}

function drawTextBlock(page, text, options) {
  const {
    x,
    y,
    width,
    font,
    size,
    lineHeight,
    color = rgb(0.12, 0.16, 0.2),
    maxLines = Infinity
  } = options;

  const lines = truncateLines(splitTextIntoLines(text, font, size, width), maxLines);
  let cursorY = y;

  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, font, size, color });
    cursorY -= lineHeight;
  }

  return cursorY;
}

function measureTextBlockHeight(text, font, size, lineHeight, width, maxLines = Infinity) {
  const lines = truncateLines(splitTextIntoLines(text, font, size, width), maxLines);
  return lines.length === 0 ? 0 : lines.length * lineHeight;
}

function getRowText(row) {
  if (row?.value?.kind === "colors") {
    return row.value.items.map((item) => item.label).join(", ");
  }

  return row?.value?.text || "";
}

function drawColorValue(page, row, x, y, maxWidth, fonts) {
  const { regularFont } = fonts;
  const items = Array.isArray(row?.value?.items) ? row.value.items : [];
  const fontSize = 10;
  const swatchRadius = 3.5;
  const swatchGap = 5;
  const itemGap = 10;
  const lineHeight = 12;
  let cursorX = x;
  let cursorY = y;

  for (const item of items) {
    const label = String(item?.label || "").trim();
    if (!label) {
      continue;
    }

    const labelWidth = regularFont.widthOfTextAtSize(label, fontSize);
    const itemWidth = (swatchRadius * 2) + swatchGap + labelWidth;
    if (cursorX > x && cursorX + itemWidth > x + maxWidth) {
      cursorX = x;
      cursorY -= lineHeight;
    }

    const swatchStyle = COLOR_SWATCH_STYLES[item.key] || COLOR_SWATCH_STYLES.multicolor;
    page.drawCircle({
      x: cursorX + swatchRadius,
      y: cursorY + 2,
      size: swatchRadius,
      color: swatchStyle.fill,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.6
    });
    page.drawText(label, {
      x: cursorX + (swatchRadius * 2) + swatchGap,
      y: cursorY - 2,
      font: regularFont,
      size: fontSize,
      color: rgb(0.12, 0.16, 0.2)
    });
    cursorX += itemWidth + itemGap;
  }
}

function drawDetailGroup(page, group, startX, startY, width, fonts) {
  const { regularFont, boldFont } = fonts;
  const columnGap = 12;
  const contentWidth = width - BOX_PADDING * 2;
  const columnWidth = (contentWidth - columnGap) / 2;
  const rowLabelSize = 8;
  const rowValueSize = 10;
  const rowLabelLineHeight = 10;
  const rowValueLineHeight = 12;

  const rows = group.items.map((row) => {
    const labelHeight = measureTextBlockHeight(row.label, boldFont, rowLabelSize, rowLabelLineHeight, columnWidth, 2);
    const valueHeight = measureTextBlockHeight(getRowText(row), regularFont, rowValueSize, rowValueLineHeight, columnWidth, 4);
    return {
      ...row,
      height: labelHeight + valueHeight + 7
    };
  });

  const columnHeights = [0, 0];
  const positionedRows = rows.map((row) => {
    const targetColumn = columnHeights[0] <= columnHeights[1] ? 0 : 1;
    const offsetY = columnHeights[targetColumn];
    columnHeights[targetColumn] += row.height + 6;
    return {
      ...row,
      column: targetColumn,
      offsetY
    };
  });

  const boxHeight = Math.max(columnHeights[0], columnHeights[1]) + BOX_PADDING * 2 - 6;
  drawRoundedRect(page, {
    x: startX,
    y: startY - boxHeight,
    width,
    height: boxHeight,
    radius: BLOCK_RADIUS,
    color: SUBTLE_BLOCK_COLOR
  });

  for (const row of positionedRows) {
    const rowX = startX + BOX_PADDING + (row.column * (columnWidth + columnGap));
    let rowY = startY - BOX_PADDING - row.offsetY - rowLabelLineHeight;
    rowY = drawTextBlock(page, row.label, {
      x: rowX,
      y: rowY,
      width: columnWidth,
      font: boldFont,
      size: rowLabelSize,
      lineHeight: rowLabelLineHeight,
      color: rgb(0.43, 0.48, 0.53),
      maxLines: 2
    });
    if (row?.value?.kind === "colors") {
      drawColorValue(page, row, rowX, rowY - 2, columnWidth, fonts);
    } else {
      drawTextBlock(page, getRowText(row), {
        x: rowX,
        y: rowY - 4,
        width: columnWidth,
        font: regularFont,
        size: rowValueSize,
        lineHeight: rowValueLineHeight,
        color: rgb(0.12, 0.16, 0.2),
        maxLines: 4
      });
    }
  }

  return startY - boxHeight - 8;
}

async function drawProductPage(pdfDoc, product, locale, fonts, imageAssetsById = {}, imageLoadStats = null) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { regularFont, boldFont } = fonts;
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  const title = product?.name || t("search.untitled", undefined, locale);
  const category = product?.category ? translateOption("categories", product.category, locale) : "";
  const detailGroups = buildProductDetailGroups(product, {
    t: (key, params) => t(key, params, locale),
    translateOption,
    locale
  });

  const titleFontSize = 18;
  const titleLineHeight = 22;
  const titleLines = truncateLines(
    splitTextIntoLines(title, regularFont, titleFontSize, CONTENT_WIDTH - 16),
    3
  );
  const titleHeight = titleLines.length * titleLineHeight;
  let titleY = cursorY;
  for (const line of titleLines) {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y: titleY,
      font: regularFont,
      size: titleFontSize,
      color: LINK_COLOR
    });
    titleY -= titleLineHeight;
  }

  if (product?.url) {
    let underlineY = cursorY - 2;
    for (const line of titleLines) {
      const lineWidth = regularFont.widthOfTextAtSize(line, titleFontSize);
      page.drawLine({
        start: { x: PAGE_MARGIN, y: underlineY },
        end: { x: PAGE_MARGIN + lineWidth, y: underlineY },
        thickness: 0.8,
        color: LINK_COLOR
      });
      underlineY -= titleLineHeight;
    }
  }

  if (product?.url) {
    const titleTopY = cursorY + (titleFontSize * 0.9);
    const titleBottomY = cursorY - titleHeight + 3;
    addLinkAnnotation(pdfDoc, page, product.url, {
      x: PAGE_MARGIN,
      y: titleBottomY,
      width: CONTENT_WIDTH,
      height: Math.max(0, titleTopY - titleBottomY)
    });
  }

  cursorY = cursorY - titleHeight;

  if (product?.brand) {
    cursorY -= 2;
    cursorY = drawTextBlock(page, product.brand, {
      x: PAGE_MARGIN,
      y: cursorY,
      width: CONTENT_WIDTH,
      font: regularFont,
      size: 12,
      lineHeight: 15,
      maxLines: 2
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
      maxLines: 1
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
      maxLines: 8
    });
  }

  cursorY -= 8;
  for (const group of detailGroups) {
    cursorY = drawDetailGroup(page, group, PAGE_MARGIN, cursorY, CONTENT_WIDTH, fonts);
  }

  const imageTop = cursorY - 8;
  const imageBounds = {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN,
    width: CONTENT_WIDTH,
    height: Math.max(180, imageTop - PAGE_MARGIN)
  };

  drawRoundedRect(page, {
    x: imageBounds.x,
    y: imageBounds.y,
    width: imageBounds.width,
    height: imageBounds.height,
    radius: BLOCK_RADIUS,
    color: IMAGE_BACKGROUND_COLOR,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1
  });

  const assetKey = String(product?.id || "");
  let imageBytes = await loadImageBytes(
    product?.imageUrl,
    imageAssetsById[assetKey] || null,
    {
      width: (imageBounds.width - 2) * 2,
      height: (imageBounds.height - 2) * 2
    },
    imageLoadStats
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
      maxLines: 5
    });
    return;
  }

  let embeddedImage = imageBytes.kind === "jpg"
    ? await pdfDoc.embedJpg(imageBytes.bytes)
    : await pdfDoc.embedPng(imageBytes.bytes);
  imageBytes = null;
  const scaled = embeddedImage.scaleToFit(imageBounds.width - 2, imageBounds.height - 2);
  const imageX = imageBounds.x + ((imageBounds.width - scaled.width) / 2);
  const imageY = imageBounds.y + ((imageBounds.height - scaled.height) / 2);

  page.drawImage(embeddedImage, {
    x: imageX,
    y: imageY,
    width: scaled.width,
    height: scaled.height
  });
  embeddedImage = null;
}

async function buildWardrobePdf(products, { locale = "en", imageAssetsById = {}, totalStartedAt = null } = {}) {
  const buildStartedAt = Date.now();
  const imageLoadStats = {
    cachedCount: 0,
    downloadedCount: 0
  };
  logPdfEvent("build-start", {
    productsTotal: products.length,
    imageAssetBytes: sumImageAssetBytesById(imageAssetsById)
  });
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const useFallbackFonts = locale === "ru" || products.some((product) => productNeedsUnicodeFallback(product, locale));
  const regularFontBytes = readFileSync(
    useFallbackFonts ? resolveFontPath(FALLBACK_REGULAR_FONT_CANDIDATES) : DM_SANS_REGULAR_PATH
  );
  const boldFontBytes = readFileSync(
    useFallbackFonts ? resolveFontPath(FALLBACK_BOLD_FONT_CANDIDATES) : DM_SANS_BOLD_PATH
  );
  const regularFont = await pdfDoc.embedFont(regularFontBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true });

  for (const product of products) {
    await drawProductPage(pdfDoc, product, locale, { regularFont, boldFont }, imageAssetsById, imageLoadStats);
  }

  const buffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  logPdfEvent("build-completed", {
    durationMs: Date.now() - buildStartedAt,
    totalDurationMs: Number.isFinite(totalStartedAt) ? Date.now() - totalStartedAt : undefined,
    productsTotal: products.length,
    cachedCount: imageLoadStats.cachedCount,
    downloadedCount: imageLoadStats.downloadedCount,
    pdfBytes: buffer.length,
    remainingImageAssetBytes: sumImageAssetBytesById(imageAssetsById)
  });
  return buffer;
}

async function buildWardrobePdfInChild(products, locale = "en", { forkImpl = nodeFork, totalStartedAt = null } = {}) {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "wardrobe-pdf-child-"));
  const outputFilePath = path.join(outputDir, "capsule-wardrobe.pdf");

  try {
    return await new Promise((resolve, reject) => {
      const child = forkImpl(fileURLToPath(WARDROBE_PDF_CHILD_PATH), {
        stdio: ["ignore", "inherit", "inherit", "ipc"],
        execArgv: []
      });
      let settled = false;
      let childExited = false;

      const timeout = setTimeout(() => {
        cleanup();
        child.kill();
        reject(new Error("wardrobe_pdf_child_timeout"));
      }, WARDROBE_PDF_CHILD_TIMEOUT_MS);
      timeout.unref?.();

      function cleanup() {
        clearTimeout(timeout);
        child.removeListener("message", onMessage);
        child.removeListener("error", onError);
        child.removeListener("exit", onExit);
      }

      async function resolveFromFile(filePath) {
        try {
          const buffer = await readFile(filePath);
          if (!settled) {
            settled = true;
            cleanup();
            resolve(buffer);
          }
        } catch (error) {
          if (!settled) {
            settled = true;
            cleanup();
            reject(error);
          }
        }
      }

      function rejectOnce(error) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      }

      function onMessage(message) {
        if (message?.ok === true) {
          const filePath = String(message?.outputFilePath || "").trim();
          if (!filePath) {
            rejectOnce(new Error("wardrobe_pdf_child_invalid_payload"));
            return;
          }
          void resolveFromFile(filePath);
          return;
        }

        if (message?.ok === false) {
          const error = new Error(String(message?.message || "wardrobe_pdf_child_failed"));
          if (typeof message?.stack === "string" && message.stack.trim().length > 0) {
            error.stack = message.stack;
          }
          rejectOnce(error);
        }
      }

      function onError(error) {
        rejectOnce(error);
      }

      function onExit(code, signal) {
        childExited = true;
        if (!settled) {
          rejectOnce(new Error(`wardrobe_pdf_child_exit:${code ?? "null"}:${signal ?? "null"}`));
        }
      }

      child.on("message", onMessage);
      child.on("error", onError);
      child.on("exit", onExit);
      child.send({
        products,
        locale,
        totalStartedAt,
        outputFilePath
      }, (error) => {
        if (error && !childExited) {
          rejectOnce(error);
        }
      });
    });
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}

function scheduleWardrobePdfJobCleanup(email, job) {
  const timer = setTimeout(() => {
    if (wardrobePdfJobs.get(email) === job && job.status !== "pending") {
      wardrobePdfJobs.delete(email);
    }
  }, PDF_JOB_TTL_MS);
  timer.unref?.();
}

function getWardrobePdfJob(email) {
  const job = wardrobePdfJobs.get(email);
  if (!job) {
    return null;
  }

  if (job.status !== "pending" && Date.now() - job.updatedAt > PDF_JOB_TTL_MS) {
    wardrobePdfJobs.delete(email);
    return null;
  }

  return job;
}

function createWardrobePdfJobManager({
  getProfileByEmail = getProfile,
  getProfilePdfByEmail = getProfilePdf,
  getProfileWithPdfByEmail = null,
  updateProfilePdfByEmail = updateProfilePdf,
  getProducts = getProductsByUrlsInOrder,
  buildPdfInChild = buildWardrobePdfInChild
} = {}) {
  const loadProfileWithPdf = getProfileWithPdfByEmail
    || (
      getProfileByEmail === getProfile && getProfilePdfByEmail === getProfilePdf
        ? getProfileWithPdf
        : async (email) => ({
          profile: await getProfileByEmail(email),
          pdf: await getProfilePdfByEmail(email)
        })
    );

  function startWardrobePdfJob(email, {
    wardrobePayload = null,
    locale = null
  } = {}) {
    const expectedItems = wardrobePayload ?? null;
    const expectedLocale = locale ?? null;
    const resolvedItems = sortWardrobeItems(
      wardrobePayload && !Array.isArray(wardrobePayload)
        ? getStoredWardrobeItems({ items: wardrobePayload })
        : getStoredWardrobeItems({ items: wardrobePayload })
    );
    const resolvedLocale = getPdfLocale(locale);
    const generationKey = createWardrobePdfGenerationKey({
      items: resolvedItems,
      locale: resolvedLocale
    });
    const existing = getWardrobePdfJob(email);

    if (existing?.status === "pending" && existing.generationKey === generationKey) {
      return existing;
    }

    const job = {
      status: "pending",
      updatedAt: Date.now(),
      startedAt: Date.now(),
      generationKey,
      error: null,
      promise: null
    };
    wardrobePdfJobs.set(email, job);

    job.promise = (async () => {
      try {
        let profile = null;
        let items = resolvedItems;
        let pdfLocale = resolvedLocale;

        if (items.length === 0 || !locale) {
          profile = await getProfileByEmail(email);
          items = sortWardrobeItems(getStoredWardrobeItems(profile));
          pdfLocale = getPdfLocale(profile?.locale);
        }

        const productUrls = items
          .map((item) => String(item?.url || "").trim())
          .filter(Boolean);

        if (productUrls.length === 0) {
          throw new Error("wardrobe_pdf_items_missing");
        }

        const products = await getProducts(productUrls);
        const foundUrls = new Set(products.map((product) => String(product?.url || "")));
        const missingUrls = productUrls.filter((url) => !foundUrls.has(url));
        if (missingUrls.length > 0) {
          console.warn("[wardrobe-pdf][missing-products]", JSON.stringify({ email, missingUrls }));
        }

        if (products.length === 0) {
          throw new Error("wardrobe_pdf_products_missing");
        }

        const pdfBuffer = await runWithImageWorkSlot("wardrobe-pdf-build", async () => {
          const builtPdf = await buildPdfInChild(products, pdfLocale, {
            totalStartedAt: job.startedAt
          });
          return builtPdf;
        });

        if (wardrobePdfJobs.get(email) !== job) {
          return;
        }

        const updatedProfile = await updateProfilePdfByEmail(email, pdfBuffer, {
          expectedItems,
          expectedLocale
        });
        if (!updatedProfile) {
          job.status = "completed";
          job.updatedAt = Date.now();
          return;
        }

        job.status = "completed";
        job.updatedAt = Date.now();
      } catch (error) {
        if (wardrobePdfJobs.get(email) !== job) {
          return;
        }
        job.status = "failed";
        job.updatedAt = Date.now();
        job.error = error;
        console.error("[wardrobe-pdf][job]", error);
      } finally {
        scheduleWardrobePdfJobCleanup(email, job);
      }
    })();

    return job;
  }

  async function ensureWardrobePdfJob(email, options = {}) {
    const existing = getWardrobePdfJob(email);
    if (existing?.status === "pending") {
      return existing;
    }

    if (existing?.status === "failed") {
      wardrobePdfJobs.delete(email);
    }

    let profile = null;
    let wardrobePayload = options.wardrobePayload || null;
    let locale = options.locale || null;

    if (!wardrobePayload || !locale) {
      profile = await getProfileByEmail(email);
      if (!profile) {
        return null;
      }
      wardrobePayload = wardrobePayload || profile.items;
      locale = locale || profile.locale;
    }

    const items = sortWardrobeItems(getStoredWardrobeItems({ items: wardrobePayload }));
    if (items.length === 0) {
      return null;
    }

    return startWardrobePdfJob(email, {
      wardrobePayload,
      locale
    });
  }

  async function downloadWardrobePdf(req, res) {
    try {
      const email = req.user.email;
      const { profile, pdf } = await loadProfileWithPdf(email);
      const storedWardrobeItems = sortWardrobeItems(getStoredWardrobeItems(profile));

      if (storedWardrobeItems.length === 0) {
        return res.status(404).json({ error: "not_found" });
      }

      const storedPdf = normalizeStoredPdf(pdf);
      if (storedPdf) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="capsule-wardrobe.pdf"');
        return res.status(200).send(storedPdf);
      }

      await ensureWardrobePdfJob(email, {
        wardrobePayload: profile?.items,
        locale: profile?.locale
      });

      return res.status(202).json({
        ok: true,
        status: "pending",
        pollAfterMs: WARDROBE_PDF_POLL_AFTER_MS
      });
    } catch (error) {
      console.error("[wardrobe-pdf]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  }

  return {
    startWardrobePdfJob,
    ensureWardrobePdfJob,
    getWardrobePdfJob,
    downloadWardrobePdf
  };
}

const wardrobePdfJobManager = createWardrobePdfJobManager();
const { startWardrobePdfJob, ensureWardrobePdfJob, downloadWardrobePdf } = wardrobePdfJobManager;

export {
  DEFAULT_PDF_IMAGE_TARGET_SIZE,
  buildWardrobePdf,
  buildWardrobePdfInChild,
  createWardrobePdfJobManager,
  createWardrobePdfGenerationKey,
  getWardrobePdfJob,
  startWardrobePdfJob,
  ensureWardrobePdfJob,
  downloadWardrobePdf
};
