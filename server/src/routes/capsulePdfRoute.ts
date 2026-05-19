import { logError } from "../logger.js";
import { normalizeWardrobeItemForPdf } from "../wardrobePdfItems.js";

function getTrimmedString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function getHttpUrl(value) {
  const normalized = getTrimmedString(value);
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

function getWardrobeIdFromValue(value) {
  const normalized = getTrimmedString(value);
  const match = normalized.match(/^W?([1-9]\d*)$/i);
  return match ? Number(match[1]) : null;
}

function getWardrobeIdFromUrl(value) {
  const normalized = getTrimmedString(value);
  const match = normalized.match(/^wardrobe:\/\/([1-9]\d*)(?:[/?#]|$)/i);
  return match ? Number(match[1]) : null;
}

function getCapsuleItemWardrobeId(item) {
  return (
    getWardrobeIdFromValue(item?.wardrobeId) ||
    getWardrobeIdFromUrl(item?.url) ||
    getWardrobeIdFromValue(item?.id)
  );
}

function isWardrobeSourcedItem(item) {
  const source = getTrimmedString(item?.source).toLowerCase();
  const itemSource = getTrimmedString(item?.itemSource).toLowerCase();
  return (
    Boolean(getCapsuleItemWardrobeId(item)) ||
    source === "uploaded" ||
    source === "from_catalog" ||
    itemSource === "wardrobe" ||
    /^wardrobe:\/\//i.test(getTrimmedString(item?.url))
  );
}

function keyBy(items, getKey) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = getKey(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  }
  return map;
}

async function getCapsulePdfItems(email, items, context) {
  const productUrls = [
    ...new Set(items.map((item) => getHttpUrl(item?.url)).filter(Boolean)),
  ];
  const wardrobeIds = [
    ...new Set(
      items.map(getCapsuleItemWardrobeId).filter((id) => Number.isInteger(id)),
    ),
  ];
  const [products, wardrobeItems] = await Promise.all([
    context.getProductsByUrlsInOrderImpl(productUrls),
    wardrobeIds.length > 0 && context.listWardrobeItemsByIdsImpl
      ? context.listWardrobeItemsByIdsImpl({ email, ids: wardrobeIds })
      : [],
  ]);
  const productsByUrl = keyBy(products, (product) => getHttpUrl(product?.url));
  const wardrobeItemsById = keyBy(wardrobeItems, (item) =>
    getWardrobeIdFromValue(item?.id),
  );

  return items
    .map((item) => {
      const wardrobeId = getCapsuleItemWardrobeId(item);
      const productUrl = getHttpUrl(item?.url);
      const resolvedItem =
        (wardrobeId ? wardrobeItemsById.get(wardrobeId) : null) ||
        (productUrl ? productsByUrl.get(productUrl) : null) ||
        (isWardrobeSourcedItem(item) ? item : null);
      return resolvedItem ? normalizeWardrobeItemForPdf(resolvedItem) : null;
    })
    .filter(Boolean);
}

export function registerCapsulePdfRoute(app, context) {
  app.post(
    "/capsules/:id/pdf",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.getCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }
        const profile = await context.getProfileImpl(req.user.email);
        const items = context.getCapsuleItems(capsule);
        if (items.length === 0) {
          return res.status(404).json({ error: "not_found" });
        }
        const pdfItems = await getCapsulePdfItems(
          req.user.email,
          items,
          context,
        );
        if (pdfItems.length === 0) {
          return res.status(404).json({ error: "not_found" });
        }
        const pdfBuffer = await context.buildWardrobePdfInChildImpl(
          pdfItems,
          String(profile?.locale || "en"),
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          context.buildPdfDownloadFilename(capsule?.name),
        );
        return res.status(200).send(pdfBuffer);
      } catch (error) {
        logError("[capsules/pdf]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}
