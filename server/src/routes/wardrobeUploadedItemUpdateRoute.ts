import { logError } from "../logger.js";
import { getOwnedWardrobeR2KeysFromItem } from "../wardrobeR2Keys.js";
import { normalizeUploadedWardrobeItemDetails } from "../wardrobeUploadedItemUpdate.js";

function registerUploadedWardrobeItemUpdateRoute(app, context, filterItem) {
  registerUploadedWardrobeItemDetailRoute(app, context, filterItem);
  registerUploadedWardrobeItemDeleteRoute(app, context);

  app.patch(
    "/wardrobe/items/uploaded/:id",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const id = String(req.params?.id || "").trim();
      const details = normalizeUploadedWardrobeItemDetails(req.body || {});
      if (!id || !details) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        let embedding: number[] | null = null;
        let processingStatus = "ready";
        try {
          embedding =
            await context.createUploadedWardrobeItemEmbeddingImpl(details);
        } catch (embeddingError) {
          logError("[wardrobe/items/uploaded/:id][embedding]", embeddingError);
          processingStatus = "failed";
        }
        const item = await context.updateUploadedWardrobeItemDetailsImpl({
          embedding,
          email: req.user.email,
          id,
          details,
          processingStatus,
        });
        if (!item) {
          return res.status(404).json({ error: "not_found" });
        }
        const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);

        return res.json({
          ok: true,
          item: context.annotateLikedItems(filterItem(item), likedUrls),
        });
      } catch (error) {
        logError("[wardrobe/items/uploaded/:id]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerUploadedWardrobeItemDetailRoute(app, context, filterItem) {
  app.get(
    "/wardrobe/items/uploaded/:id",
    context.requireAuth,
    async (req, res) => {
      const id = String(req.params?.id || "").trim();
      if (!id) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const item = await context.getUploadedWardrobeItemImpl({
          email: req.user.email,
          id,
        });
        if (!item) {
          return res.status(404).json({ error: "not_found" });
        }
        const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);

        return res.json({
          ok: true,
          item: context.annotateLikedItems(filterItem(item), likedUrls),
        });
      } catch (error) {
        logError("[wardrobe/items/uploaded/:id][get]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerUploadedWardrobeItemDeleteRoute(app, context) {
  app.delete(
    "/wardrobe/items/uploaded/:id",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const id = String(req.params?.id || "").trim();
      if (!id) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const item = await context.deleteUploadedWardrobeItemImpl({
          email: req.user.email,
          id,
        });
        if (!item) {
          return res.json({ ok: true, removed: false });
        }

        const keys = getOwnedWardrobeR2KeysFromItem(item, req.user.email);
        if (keys.length > 0) {
          await context.deleteR2ObjectsImpl({ keys }).catch((error) => {
            logError("[delete wardrobe/items/uploaded/:id][r2]", error);
          });
        }

        return res.json({ ok: true, removed: true });
      } catch (error) {
        logError("[delete wardrobe/items/uploaded/:id]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export { registerUploadedWardrobeItemUpdateRoute };
