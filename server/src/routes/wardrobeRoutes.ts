import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { logError } from "../logger.js";
import {
  WARDROBE_UPLOAD_FIELD_NAME,
  WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES,
  WARDROBE_UPLOAD_MAX_FILES,
  isAllowedWardrobeUploadMimeType,
} from "../wardrobeUploadImagesCore.js";
import {
  openWardrobeUploadEventStream,
  processUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
} from "./wardrobeUploadStream.js";

const wardrobeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES,
    files: WARDROBE_UPLOAD_MAX_FILES,
    parts: WARDROBE_UPLOAD_MAX_FILES,
  },
  fileFilter: (_req, file, callback) => {
    if (isAllowedWardrobeUploadMimeType(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("invalid_image"));
  },
}).array(WARDROBE_UPLOAD_FIELD_NAME, WARDROBE_UPLOAD_MAX_FILES);

function normalizeWardrobeSourceParam(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value === "uploaded" || value === "from_catalog" ? value : "";
}

function getHttpUrl(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function getFirstPresentValue(...values) {
  return (
    values.find(
      (value) => value !== undefined && value !== null && value !== "",
    ) ?? null
  );
}

const WARDROBE_ITEM_PRIVATE_FIELDS = new Set([
  "createdAt",
  "created_at",
  "email",
  "productId",
  "product_id",
  "profileEmail",
  "profile_email",
  "updatedAt",
  "updated_at",
]);

function filterWardrobeItemForDisplay(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  return Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => !WARDROBE_ITEM_PRIVATE_FIELDS.has(key),
    ),
  );
}

function normalizeWardrobeItemForPdf(item) {
  const source = item || {};
  return {
    ...source,
    imageUrl: getFirstPresentValue(
      source.imageUrl,
      source.image_url,
      source.raw_image_url,
    ),
    rawImageUrl: getFirstPresentValue(source.rawImageUrl, source.raw_image_url),
    formalityLevel: getFirstPresentValue(
      source.formalityLevel,
      source.formality_level,
    ),
    colorBase: getFirstPresentValue(source.colorBase, source.color_base),
    isNeutral: getFirstPresentValue(source.isNeutral, source.is_neutral),
    closureType: getFirstPresentValue(source.closureType, source.closure_type),
  };
}

export function registerWardrobeRoutes(app, context) {
  registerWardrobeListRoute(app, context);
  registerWardrobeUploadRoute(app, context);
  registerWardrobePdfRoute(app, context);
  registerWardrobeCatalogRoutes(app, context);
}

function registerWardrobeListRoute(app, context) {
  app.get("/wardrobe/items", context.requireAuth, async (req, res) => {
    const source = normalizeWardrobeSourceParam(req.query?.source);
    if (source === "") {
      return res.status(400).json({ error: "invalid_payload" });
    }

    try {
      const items = await context.listWardrobeItemsImpl({
        email: req.user.email,
        source,
      });
      const displayItems = Array.isArray(items)
        ? items.map(filterWardrobeItemForDisplay)
        : items;
      return res.json({ ok: true, items: displayItems });
    } catch (error) {
      logError("[wardrobe/items]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function runWardrobeUploadMiddleware(req, res) {
  return new Promise<boolean>((resolve) => {
    wardrobeUpload(req, res, (error) => {
      if (!error) {
        resolve(true);
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "file_too_large" });
          resolve(false);
          return;
        }

        if (
          error.code === "LIMIT_FILE_COUNT" ||
          error.code === "LIMIT_PART_COUNT" ||
          error.code === "LIMIT_UNEXPECTED_FILE"
        ) {
          res.status(400).json({ error: "too_many_files" });
          resolve(false);
          return;
        }
      }

      if (error?.message === "invalid_image") {
        res.status(400).json({ error: "invalid_image" });
        resolve(false);
        return;
      }

      logError("[wardrobe/items/upload][parse]", error);
      res.status(400).json({ error: "invalid_payload" });
      resolve(false);
    });
  });
}

async function getValidatedWardrobeUploadImages(files) {
  const images = [];

  for (const file of files) {
    const detectedType = await fileTypeFromBuffer(file.buffer);
    if (!isAllowedWardrobeUploadMimeType(detectedType?.mime)) {
      throw new Error("invalid_image");
    }

    images.push({
      buffer: file.buffer,
      mimeType: detectedType.mime,
      originalName: String(file.originalname || "wardrobe-image"),
    });
  }

  return images;
}

function registerWardrobeUploadRoute(app, context) {
  app.post(
    "/wardrobe/items/upload",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const parsed = await runWardrobeUploadMiddleware(req, res);
      if (!parsed) {
        return;
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const images = await getValidatedWardrobeUploadImages(files);
        openWardrobeUploadEventStream(res);
        const normalizedImages =
          await context.normalizeWardrobeUploadImagesInChildImpl(images);
        const uploadedImages = await Promise.all(
          normalizedImages.map((image) =>
            context.uploadWardrobeImageToR2Impl({
              buffer: image.buffer,
              email: req.user.email,
            }),
          ),
        );
        const items = await context.saveUploadedWardrobeItemsImpl({
          email: req.user.email,
          imageUrls: uploadedImages.map((image) => image.url),
        });
        const displayItems = Array.isArray(items)
          ? items.map(filterWardrobeItemForDisplay)
          : [];
        const progress = {
          total: displayItems.length,
          uploaded: displayItems.length,
          metadataProcessed: 0,
          failed: 0,
        };
        writeWardrobeUploadEvent(res, "progress", progress);
        const processedItems = await Promise.all(
          displayItems.map((item) =>
            processUploadedWardrobeItemMetadata({
              context,
              email: req.user.email,
              filterItem: filterWardrobeItemForDisplay,
              item,
              progress,
              res,
            }),
          ),
        );

        writeWardrobeUploadEvent(res, "complete", {
          ok: true,
          ...progress,
          items: processedItems,
        });
        return res.end();
      } catch (error) {
        if (error?.message === "invalid_image") {
          return res.status(400).json({ error: "invalid_image" });
        }

        logError("[wardrobe/items/upload]", error);
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

function registerWardrobePdfRoute(app, context) {
  app.post(
    "/wardrobe/items/pdf",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const source = normalizeWardrobeSourceParam(req.query?.source);
      if (source === "") {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const items = await context.listWardrobeItemsImpl({
          email: req.user.email,
          source,
        });
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(404).json({ error: "not_found" });
        }

        const profile = await context.getProfileImpl(req.user.email);
        const pdfBuffer = await context.buildWardrobePdfInChildImpl(
          items.map(normalizeWardrobeItemForPdf),
          String(profile?.locale || "en"),
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          context.buildPdfDownloadFilename("My Wardrobe"),
        );
        return res.status(200).send(pdfBuffer);
      } catch (error) {
        logError("[wardrobe/items/pdf]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerWardrobeCatalogRoutes(app, context) {
  app.post(
    "/wardrobe/items/from-catalog",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const url = getHttpUrl(req.body?.url);
      if (!url) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const item = await context.saveWardrobeItemFromCatalogImpl({
          email: req.user.email,
          url,
        });
        if (!item) {
          return res.status(404).json({ error: "not_found" });
        }

        return res.status(201).json({
          ok: true,
          item: filterWardrobeItemForDisplay(item),
        });
      } catch (error) {
        logError("[wardrobe/items/from-catalog]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/wardrobe/items/from-catalog",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const url = getHttpUrl(req.body?.url);
      if (!url) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const removed = await context.deleteWardrobeItemFromCatalogImpl({
          email: req.user.email,
          url,
        });
        return res.json({ ok: true, removed });
      } catch (error) {
        logError("[delete wardrobe/items/from-catalog]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export {
  filterWardrobeItemForDisplay,
  getHttpUrl,
  normalizeWardrobeItemForPdf,
  normalizeWardrobeSourceParam,
};
