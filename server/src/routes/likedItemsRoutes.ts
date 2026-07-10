import {
  annotateLikedItems,
  normalizeLikedItemUrl,
} from "../likedItemsHttp.js";
import { logError } from "../logger.js";

function getLikedItemUrlPayload(body: unknown): string {
  return normalizeLikedItemUrl(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { itemUrl?: unknown }).itemUrl
      : null,
  );
}

function registerLikedItemsRoutes(app, context) {
  app.post(
    "/liked-items",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const itemUrl = getLikedItemUrlPayload(req.body);
      if (!itemUrl) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const likedItemUrl = await context.upsertLikedItemImpl({
          email: req.user.email,
          itemUrl,
        });
        return res.status(201).json({
          ok: true,
          itemUrl: likedItemUrl || itemUrl,
          isLiked: true,
        });
      } catch (error) {
        logError("liked.items.create.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/liked-items",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const itemUrl = getLikedItemUrlPayload(req.body);
      if (!itemUrl) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        await context.deleteLikedItemImpl({
          email: req.user.email,
          itemUrl,
        });
        return res.json({ ok: true, itemUrl, isLiked: false });
      } catch (error) {
        logError("liked.items.delete.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export { annotateLikedItems, registerLikedItemsRoutes };
