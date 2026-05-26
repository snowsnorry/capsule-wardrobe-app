import { logError } from "../logger.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import {
  extractOpenGraphImageUrl,
  normalizeWardrobeProductPageUploadUrls,
} from "../wardrobeProductPageImport.js";
import {
  advanceWardrobeUploadProgress,
  openWardrobeUploadEventStream,
  processUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
} from "./wardrobeUploadStream.js";

function createWardrobeUploadProgress(total) {
  return {
    total,
    uploaded: 0,
    completedSteps: 0,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };
}

async function saveWardrobeProductPageUploadedItem({
  context,
  email,
  imageUrl,
  productPageUrl,
}) {
  const items = await context.saveUploadedWardrobeItemsImpl({
    email,
    items: [
      {
        imageUrl,
        rawImageUrl: imageUrl,
        url: productPageUrl,
      },
    ],
  });
  return Array.isArray(items) ? items[0] || null : null;
}

async function processWardrobeProductPageUploadUrl({
  context,
  email,
  progress,
  res,
  url,
}) {
  try {
    const productPage = await context.fetchProductPageHtmlWithImpersImpl({
      url,
    });
    const imageUrl = extractOpenGraphImageUrl(
      productPage.html,
      productPage.url,
    );
    if (!imageUrl) {
      throw new Error("product_page_og_image_missing");
    }

    const image = await context.downloadWardrobeProductPageImageImpl({
      imageUrl,
    });
    const item = await saveWardrobeProductPageUploadedItem({
      context,
      email,
      imageUrl,
      productPageUrl: productPage.url,
    });
    if (!item) {
      throw new Error("product_page_uploaded_item_missing");
    }

    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      uploaded: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);

    return processUploadedWardrobeItemMetadata({
      analyzeItemMetadata: () =>
        context.analyzeWardrobeProductPageImageImpl({
          image: {
            buffer: Buffer.from(image.buffer),
            filename: image.originalName,
            imageUrl,
            mimeType: image.mimeType,
          },
          imageUrl,
          productPageHtml: productPage.html,
          productPageUrl: productPage.url,
        }),
      context,
      email,
      filterItem: filterWardrobeItemForDisplay,
      item: filterWardrobeItemForDisplay(item),
      progress,
      res,
      sourceImage: {
        buffer: image.buffer,
        mimeType: image.mimeType,
        originalName: image.originalName,
      },
      sourceImageKey: context.buildRemoteWardrobeImageSourceKeyImpl({
        email,
        image,
      }),
    });
  } catch (error) {
    logError("[wardrobe/items/upload-url][item]", { url }, error);
    advanceWardrobeUploadProgress(progress, {
      completedSteps: 3,
      failed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return null;
  }
}

function registerWardrobeUrlUploadRoute(app, context) {
  app.post(
    "/wardrobe/items/upload-url",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const urls = normalizeWardrobeProductPageUploadUrls(req.body?.urls);
      if (!urls) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        openWardrobeUploadEventStream(res);
        const progress = createWardrobeUploadProgress(urls.length);
        const processedItems = [];

        for (const url of urls) {
          const item = await processWardrobeProductPageUploadUrl({
            context,
            email: req.user.email,
            progress,
            res,
            url,
          });
          if (item) {
            processedItems.push(item);
          }
        }

        writeWardrobeUploadEvent(res, "complete", {
          ok: true,
          ...progress,
          items: processedItems,
        });
        return res.end();
      } catch (error) {
        logError("[wardrobe/items/upload-url]", error);
        if (res.headersSent) {
          writeWardrobeUploadEvent(res, "fatal", {
            error: "service_unavailable",
          });
          return res.end();
        }
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export { registerWardrobeUrlUploadRoute };
