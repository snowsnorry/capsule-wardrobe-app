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

export function registerWardrobeRoutes(app, context) {
  const {
    deleteWardrobeItemFromCatalogImpl,
    listWardrobeItemsImpl,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    saveWardrobeItemFromCatalogImpl,
  } = context;

  app.get("/wardrobe/items", requireAuth, async (req, res) => {
    const source = normalizeWardrobeSourceParam(req.query?.source);
    if (source === "") {
      return res.status(400).json({ error: "invalid_payload" });
    }

    try {
      const items = await listWardrobeItemsImpl({
        email: req.user.email,
        source,
      });
      return res.json({ ok: true, items });
    } catch (error) {
      logError("[wardrobe/items]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.post(
    "/wardrobe/items/from-catalog",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      const url = getHttpUrl(req.body?.url);
      if (!url) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const item = await saveWardrobeItemFromCatalogImpl({
          email: req.user.email,
          url,
        });
        if (!item) {
          return res.status(404).json({ error: "not_found" });
        }

        return res.status(201).json({ ok: true, item });
      } catch (error) {
        logError("[wardrobe/items/from-catalog]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/wardrobe/items/from-catalog",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      const url = getHttpUrl(req.body?.url);
      if (!url) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const removed = await deleteWardrobeItemFromCatalogImpl({
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

export { getHttpUrl, normalizeWardrobeSourceParam };
