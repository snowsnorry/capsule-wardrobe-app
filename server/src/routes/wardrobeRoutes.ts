import { logError } from "../logger.js";
import { normalizeWardrobeSourceParam } from "./wardrobeRouteParams.js";
import { registerWardrobeUploadRoute } from "./wardrobeFileUploadRoute.js";
import { registerUploadedWardrobeItemUpdateRoute } from "./wardrobeUploadedItemUpdateRoute.js";
import { registerWardrobeUrlUploadRoute } from "./wardrobeUrlUploadRoute.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import { normalizeWardrobeItemForPdf } from "../wardrobePdfItems.js";

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

export function registerWardrobeRoutes(app, context) {
  registerWardrobeListRoute(app, context);
  registerWardrobeUploadRoute(app, context);
  registerWardrobeUrlUploadRoute(app, context);
  registerUploadedWardrobeItemUpdateRoute(
    app,
    context,
    filterWardrobeItemForDisplay,
  );
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
      const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);
      const displayItems = Array.isArray(items)
        ? context.annotateLikedItems(
            items.map(filterWardrobeItemForDisplay),
            likedUrls,
          )
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
          context.buildPdfDownloadFilename("Personal items"),
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
        const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);

        return res.status(201).json({
          ok: true,
          item: context.annotateLikedItems(
            filterWardrobeItemForDisplay(item),
            likedUrls,
          ),
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
