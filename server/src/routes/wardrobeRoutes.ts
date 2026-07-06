import { logError } from "../logger.js";
import { decodeWardrobePageCursor } from "../db.js";
import {
  normalizeWardrobeCursorParam,
  normalizeWardrobeLikedOnlyParam,
  normalizeWardrobeLimitParam,
  normalizeWardrobeSourceParam,
} from "./wardrobeRouteParams.js";
import { registerWardrobeUploadRoute } from "./wardrobeFileUploadRoute.js";
import { registerUploadedWardrobeItemUpdateRoute } from "./wardrobeUploadedItemUpdateRoute.js";
import { registerWardrobeUrlUploadRoute } from "./wardrobeUrlUploadRoute.js";
import {
  areEqualStringSets,
  normalizeUrlSet,
  registerPersonalItemsReportRoutes,
} from "./personalItemsReportRoutes.js";
import {
  filterWardrobeItemForDisplay,
  filterWardrobeListItemForDisplay,
} from "../wardrobeItemDisplay.js";
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

function getItemUrls(items) {
  return Array.isArray(items)
    ? items.map((item) => item?.url).filter((url) => typeof url === "string")
    : [];
}

export function registerWardrobeRoutes(app, context) {
  registerWardrobeListRoute(app, context);
  registerPersonalItemsReportRoutes(app, context);
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
  app.get(
    "/wardrobe/items",
    context.requireAuth,
    // eslint-disable-next-line complexity
    async (req, res) => {
      const source = normalizeWardrobeSourceParam(req.query?.source);
      const likedOnly = normalizeWardrobeLikedOnlyParam(req.query?.likedOnly);
      const limit = normalizeWardrobeLimitParam(req.query?.limit);
      const cursor = normalizeWardrobeCursorParam(req.query?.cursor);
      if (
        source === "" ||
        likedOnly === "" ||
        limit === "" ||
        cursor === "" ||
        (cursor && !decodeWardrobePageCursor(cursor))
      ) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        if (context.listWardrobeItemsPageImpl) {
          const page = await context.listWardrobeItemsPageImpl({
            cursor,
            email: req.user.email,
            likedOnly,
            limit,
            source,
          });
          const displayItems = Array.isArray(page.items)
            ? page.items.map(filterWardrobeListItemForDisplay)
            : page.items;
          return res.json({
            ok: true,
            items: displayItems,
            pagination: page.pagination,
          });
        }

        const items = await context.listWardrobeItemsImpl({
          email: req.user.email,
          source,
        });
        const displayItems = Array.isArray(items)
          ? items.map(filterWardrobeListItemForDisplay)
          : items;
        const annotationBatch = Array.isArray(displayItems)
          ? likedOnly
            ? displayItems
            : displayItems.slice(0, limit)
          : displayItems;
        const likedUrls = await context.listLikedItemUrlsForUrlsImpl({
          email: req.user.email,
          itemUrls: getItemUrls(annotationBatch),
        });
        const annotatedItems = Array.isArray(annotationBatch)
          ? context.annotateLikedItems(annotationBatch, likedUrls)
          : annotationBatch;
        const pagedItems = Array.isArray(annotatedItems)
          ? annotatedItems
              .filter((item) => !likedOnly || item?.isLiked)
              .slice(0, limit)
          : annotatedItems;
        return res.json({
          ok: true,
          items: pagedItems,
          pagination: { hasMore: false, limit, nextCursor: null },
        });
      } catch (error) {
        logError("[wardrobe/items]", error);
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

        const [profile, personalItems] = await Promise.all([
          context.getProfileImpl(req.user.email),
          getPersonalItemsPdfOptions({
            context,
            email: req.user.email,
            items,
            source,
          }),
        ]);
        const pdfBuffer = await context.buildWardrobePdfInChildImpl(
          items.map(normalizeWardrobeItemForPdf),
          String(profile?.locale || "en"),
          personalItems ? { personalItems } : undefined,
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

async function getPersonalItemsPdfOptions({ context, email, items, source }) {
  if (source !== null) {
    return null;
  }

  const storedReport = await context.getPersonalItemsReportImpl(email);
  if (!storedReport?.report) {
    return null;
  }

  const currentUrls = normalizeUrlSet(Array.isArray(items) ? items : []);
  const storedUrls = Array.isArray(storedReport.personalItemUrls)
    ? [...storedReport.personalItemUrls].sort((left, right) =>
        left.localeCompare(right),
      )
    : [];

  return {
    report: storedReport.report,
    reportStale: !areEqualStringSets(storedUrls, currentUrls),
  };
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
        const displayItem = filterWardrobeItemForDisplay(item);
        const likedUrls = await context.listLikedItemUrlsForUrlsImpl({
          email: req.user.email,
          itemUrls: getItemUrls([displayItem]),
        });

        return res.status(201).json({
          ok: true,
          item: context.annotateLikedItems(displayItem, likedUrls),
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
