import { logError } from "../logger.js";
import { getR2KeyFromPublicUrl } from "../r2Storage.js";
import { normalizeUploadedWardrobeItemDetails } from "../wardrobeUploadedItemUpdate.js";

function registerUploadedWardrobeItemUpdateRoute(app, context, filterItem) {
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

function replaceImageUrlSuffix(imageUrl: string, suffix: string) {
  try {
    const url = new URL(imageUrl);
    const pathSegments = url.pathname.split("/");
    const filename = pathSegments.pop() || "";
    const lastDotIndex = filename.lastIndexOf(".");
    const basename =
      lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
    if (!basename) {
      return "";
    }

    pathSegments.push(`${basename}${suffix}.webp`);
    url.pathname = pathSegments.join("/");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function buildUploadedWardrobeItemImageKeys(item) {
  const originalUrl = String(
    item?.raw_image_url || item?.rawImageUrl || "",
  ).trim();
  const imageUrl = String(item?.image_url || item?.imageUrl || "").trim();
  const thumbnailUrls = imageUrl
    ? ["_320", "_480", "_640"].map((suffix) =>
        replaceImageUrlSuffix(imageUrl, suffix),
      )
    : [];

  return Array.from(
    new Set(
      [originalUrl, imageUrl, ...thumbnailUrls]
        .map(getR2KeyFromPublicUrl)
        .filter(Boolean),
    ),
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

        const keys = buildUploadedWardrobeItemImageKeys(item);
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

export {
  buildUploadedWardrobeItemImageKeys,
  registerUploadedWardrobeItemUpdateRoute,
};
