import { getEffectiveOutfitSnapshot } from "./outfitStore.js";
import { hashCapsuleContent } from "./db.js";
import { normalizeOutfitReportForDisplay } from "../../shared/outfitReportVerdict.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";

type OutfitItemRef = {
  url: string;
  source: "uploaded" | "from_catalog";
};

type OutfitSnapshot = {
  items?: OutfitItemRef[];
  image?: string | null;
  imageObsolete?: boolean | null;
  report?: Record<string, unknown> | null;
};

type OutfitHydrationContext = {
  email?: string;
  getProductsByUrlsForEmailImpl?: (payload: {
    email: string;
    urls: string[];
  }) => Promise<Array<Record<string, unknown>>>;
  listWardrobeItemsByUrlsImpl?: (payload: {
    email: string;
    urls: string[];
    source: "uploaded" | "from_catalog";
  }) => Promise<Array<Record<string, unknown>>>;
};

export function hasUnexpectedOutfitCreateFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const allowedKeys = new Set([
    "name",
    "items",
    "sourceCapsuleId",
    "sourceSetIndex",
  ]);
  return Object.keys(payload).some((key) => !allowedKeys.has(key));
}

export function hasUnexpectedOutfitItemsFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) => key !== "items");
}

export function toOutfitSummary(outfit) {
  const effective = getEffectiveOutfitSnapshot(outfit);
  return {
    id: outfit.id,
    name: outfit.name,
    status: outfit.status,
    createdAt: outfit.createdAt,
    updatedAt: outfit.updatedAt,
    hasDraft: Boolean(outfit.draft),
    hasSaved: Boolean(outfit.saved),
    itemCount: effective?.items?.length || 0,
  };
}

function getItemRefKey(ref: OutfitItemRef) {
  return `${ref.source}\u0000${ref.url}`;
}

function getSnapshotItems(snapshot: OutfitSnapshot | null | undefined) {
  return Array.isArray(snapshot?.items) ? snapshot.items : [];
}

function collectSnapshotRefs(outfit): OutfitItemRef[] {
  return [
    ...getSnapshotItems(outfit?.draft),
    ...getSnapshotItems(outfit?.saved),
  ]
    .map((item) => ({
      url: String(item?.url || "").trim(),
      source: item?.source,
    }))
    .filter(
      (item): item is OutfitItemRef =>
        Boolean(item.url) &&
        (item.source === "uploaded" || item.source === "from_catalog"),
    );
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => String(value || "").trim()))].filter(
    Boolean,
  );
}

function collectRefUrls(
  refs: OutfitItemRef[],
  source: OutfitItemRef["source"],
) {
  return unique(
    refs.filter((item) => item.source === source).map((item) => item.url),
  );
}

async function lookupCatalogItems({
  context,
  email,
  urls,
}: {
  context: OutfitHydrationContext;
  email: string;
  urls: string[];
}) {
  if (!email || urls.length === 0) {
    return [];
  }

  const productItems = context.getProductsByUrlsForEmailImpl
    ? await context.getProductsByUrlsForEmailImpl({ email, urls })
    : [];
  const foundProductUrls = new Set(
    productItems.map((item) => String(item?.url || "").trim()).filter(Boolean),
  );
  const missingProductUrls = urls.filter((url) => !foundProductUrls.has(url));
  const wardrobeItems =
    missingProductUrls.length && context.listWardrobeItemsByUrlsImpl
      ? await context.listWardrobeItemsByUrlsImpl({
          email,
          urls: missingProductUrls,
          source: "from_catalog",
        })
      : [];

  return productItems.concat(wardrobeItems);
}

async function lookupUploadedItems({
  context,
  email,
  urls,
}: {
  context: OutfitHydrationContext;
  email: string;
  urls: string[];
}) {
  return email && urls.length && context.listWardrobeItemsByUrlsImpl
    ? context.listWardrobeItemsByUrlsImpl({
        email,
        urls,
        source: "uploaded",
      })
    : [];
}

function addHydratedItems(
  itemsByRef: Map<string, Record<string, unknown>>,
  items: Array<Record<string, unknown>>,
  source: OutfitItemRef["source"],
) {
  for (const item of items) {
    const url = String(item?.url || "").trim();
    if (url) {
      itemsByRef.set(getItemRefKey({ url, source }), {
        ...item,
        source,
      });
    }
  }
}

async function buildHydratedItemsByRef(
  outfit,
  context: OutfitHydrationContext = {},
) {
  const refs = collectSnapshotRefs(outfit);
  const email = String(context.email || "").trim();
  const catalogUrls = collectRefUrls(refs, "from_catalog");
  const uploadedUrls = collectRefUrls(refs, "uploaded");
  const [catalogItems, uploadedItems] = await Promise.all([
    lookupCatalogItems({ context, email, urls: catalogUrls }),
    lookupUploadedItems({ context, email, urls: uploadedUrls }),
  ]);
  const itemsByRef = new Map<string, Record<string, unknown>>();

  addHydratedItems(itemsByRef, catalogItems, "from_catalog");
  addHydratedItems(itemsByRef, uploadedItems, "uploaded");

  return itemsByRef;
}

function hydrateSnapshot(
  snapshot: OutfitSnapshot | null | undefined,
  itemsByRef: Map<string, Record<string, unknown>>,
) {
  if (!snapshot) {
    return null;
  }

  return {
    items: getSnapshotItems(snapshot).map((ref) => ({
      url: ref.url,
      source: ref.source,
      item: itemsByRef.get(getItemRefKey(ref)) || null,
    })),
    image: snapshot.image || null,
    imageObsolete: Boolean(snapshot.imageObsolete),
    report: normalizeOutfitReportForDisplay(snapshot.report),
    reportMeta: buildReportMeta(snapshot),
  };
}

function getReportItemsHash(report: unknown) {
  return report && typeof report === "object" && !Array.isArray(report)
    ? String((report as Record<string, unknown>).itemsHash || "").trim()
    : "";
}

function buildReportMeta(snapshot: OutfitSnapshot) {
  const reportItemsHash = getReportItemsHash(snapshot.report);
  if (!reportItemsHash) {
    return null;
  }
  return {
    stale: reportItemsHash !== hashCapsuleContent(getSnapshotItems(snapshot)),
  };
}

export async function toOutfitResponse(
  outfit,
  context: OutfitHydrationContext = {},
) {
  const itemsByRef = await buildHydratedItemsByRef(outfit, context);
  return {
    ...toOutfitSummary(outfit),
    draft: hydrateSnapshot(outfit.draft, itemsByRef),
    saved: hydrateSnapshot(outfit.saved, itemsByRef),
    effective: hydrateSnapshot(getEffectiveOutfitSnapshot(outfit), itemsByRef),
  };
}

export async function getOutfitItems(
  outfit,
  context: OutfitHydrationContext = {},
) {
  const effective = getEffectiveOutfitSnapshot(outfit);
  const itemsByRef = await buildHydratedItemsByRef(outfit, context);
  const items = getSnapshotItems(effective)
    .map((ref) => itemsByRef.get(getItemRefKey(ref)))
    .filter(Boolean);
  return sortWardrobeItems(items);
}
