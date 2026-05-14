import { logError } from "../logger.js";

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
