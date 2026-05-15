import { logError } from "../logger.js";
import { normalizeUploadedWardrobeItemDetails } from "../wardrobeUploadedItemUpdate.js";

function registerUploadedWardrobeItemUpdateRoute(app, context, filterItem) {
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
        const item = await context.updateUploadedWardrobeItemDetailsImpl({
          email: req.user.email,
          id,
          details,
        });
        if (!item) {
          return res.status(404).json({ error: "not_found" });
        }

        return res.json({
          ok: true,
          item: filterItem(item),
        });
      } catch (error) {
        logError("[wardrobe/items/uploaded/:id]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export { registerUploadedWardrobeItemUpdateRoute };
