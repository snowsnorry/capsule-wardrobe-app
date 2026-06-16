import { logError } from "../logger.js";
import { buildCapsuleReportMeta } from "../capsuleHttp.js";
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

function isWardrobeSourcedItem(item) {
  const source = getTrimmedString(item?.source).toLowerCase();
  return source === "uploaded" || source === "from_catalog";
}

function getCapsuleItemWardrobeId(item) {
  if (!isWardrobeSourcedItem(item)) {
    return null;
  }

  return (
    getWardrobeIdFromValue(item?.wardrobeId) || getWardrobeIdFromValue(item?.id)
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

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildCapsulePdfOptions(capsule, effectiveSnapshot) {
  if (!isPlainObject(effectiveSnapshot?.report)) {
    return undefined;
  }

  return {
    capsule: {
      title: String(capsule?.name || "").trim(),
      report: effectiveSnapshot.report,
      reportStale: Boolean(buildCapsuleReportMeta(effectiveSnapshot)?.stale),
    },
  };
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
        const effectiveSnapshot = context.getEffectiveCapsuleSnapshot(capsule);
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
          buildCapsulePdfOptions(capsule, effectiveSnapshot),
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
