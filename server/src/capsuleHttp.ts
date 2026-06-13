/* eslint-disable complexity */
import {
  buildSnapshotFromProfile,
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleSnapshot,
} from "./capsuleStore.js";
import { hashCapsuleContent } from "./db.js";
import {
  getOutfitReportPromptItemId,
  toOutfitReportItem,
} from "./ai/outfitReportItems.js";
import type { WardrobeUiItemLike } from "./ai/types.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";

const NO_GENERATED_OUTFITS_MESSAGE =
  "No generated outfit sets were provided for this capsule.";

type RejectedUrlsValidationResult =
  | { error: "invalid_payload" | "not_found" }
  | { rejectedUrls: string[] };

export function buildPdfDownloadFilename(capsuleName) {
  const normalizedName = String(capsuleName || "")
    .replaceAll(/[\s\S]/g, (char) =>
      char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f ? " " : char,
    )
    .replace(/[\\/:"*?<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const baseName = normalizedName || "capsule-wardrobe";
  const asciiFallback =
    baseName
      .replace(/[^\x20-\x7e]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "capsule-wardrobe";
  const encodedUtf8Name = encodeURIComponent(`${baseName}.pdf`);
  return `attachment; filename="${asciiFallback}.pdf"; filename*=UTF-8''${encodedUtf8Name}`;
}

export function isApiPath(pathname = "") {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/capsules") ||
    pathname.startsWith("/outfits") ||
    pathname.startsWith("/shared-capsules") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/wardrobe") ||
    pathname.startsWith("/liked-items") ||
    pathname.startsWith("/health") ||
    pathname === "/search/options" ||
    pathname === "/search/me" ||
    pathname === "/search/run" ||
    pathname === "/search/stats"
  );
}

export function hasOwnProperty(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

export function isTruthyQueryFlag(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

export function hasUnexpectedCapsuleCreateFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const allowedKeys = new Set(["name", "filters"]);
  return Object.keys(payload).some((key) => !allowedKeys.has(key));
}

export function hasUnexpectedCapsuleFiltersFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) => key !== "filters");
}

export function hasUnexpectedRejectedUrlsFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) => key !== "rejectedUrls");
}

export function buildCapsuleDraftFromFilters(profile, filters = null) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return buildSnapshotFromProfile(profile);
  }

  const normalizedFilters = normalizeCapsuleSnapshot({
    filters,
  })?.filters;

  return {
    filters: normalizedFilters || buildSnapshotFromProfile(profile)?.filters,
    data: {
      wardrobe: null,
      rejectedUrls: [],
    },
  };
}

export function getValidatedRejectedUrls(
  capsule,
  rejectedUrls,
): RejectedUrlsValidationResult | null {
  if (!Array.isArray(rejectedUrls)) {
    return null;
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const wardrobeItems: WardrobeUiItemLike[] = Array.isArray(
    effectiveSnapshot?.data?.wardrobe?.items,
  )
    ? (effectiveSnapshot.data.wardrobe.items as WardrobeUiItemLike[])
    : [];

  if (wardrobeItems.length === 0) {
    return { error: "not_found" };
  }

  const allowedUrls = new Set(
    wardrobeItems.map((item) => String(item?.url || "").trim()).filter(Boolean),
  );

  if (allowedUrls.size === 0) {
    return { error: "not_found" };
  }

  const normalizedRejectedUrls = [];
  for (const itemUrl of rejectedUrls) {
    if (typeof itemUrl !== "string") {
      return { error: "invalid_payload" };
    }

    const normalizedItemUrl = itemUrl.trim();
    if (!normalizedItemUrl || !allowedUrls.has(normalizedItemUrl)) {
      return { error: "invalid_payload" };
    }

    normalizedRejectedUrls.push(normalizedItemUrl);
  }

  return { rejectedUrls: [...new Set(normalizedRejectedUrls)] };
}

export function toCapsuleSummary(capsule) {
  const effective = getEffectiveCapsuleSnapshot(capsule);
  return {
    id: capsule.id,
    name: capsule.name,
    status: capsule.status,
    createdAt: capsule.createdAt,
    updatedAt: capsule.updatedAt,
    hasDraft: Boolean(capsule.draft),
    hasSaved: Boolean(capsule.saved),
    filters: effective?.filters || null,
  };
}

export function toCapsuleResponse(capsule) {
  return {
    ...toCapsuleSummary(capsule),
    draft: toCapsuleSnapshotResponse(capsule.draft),
    saved: toCapsuleSnapshotResponse(capsule.saved),
    effective: toCapsuleSnapshotResponse(getEffectiveCapsuleSnapshot(capsule)),
  };
}

function getCapsuleReportItemsHash(report) {
  return report && typeof report === "object" && !Array.isArray(report)
    ? String(report.itemsHash || "").trim()
    : "";
}

function getRawItemId(item) {
  const id = item?.id;
  return typeof id === "string" || typeof id === "number"
    ? String(id).trim()
    : "";
}

function buildPromptItemIdMap(items) {
  const itemIdMap = new Map();
  for (const item of items) {
    const rawId = getRawItemId(item);
    const promptId = getOutfitReportPromptItemId(item);
    if (rawId && promptId) {
      itemIdMap.set(rawId, promptId);
      itemIdMap.set(promptId, promptId);
    }
  }
  return itemIdMap;
}

function mapGeneratedOutfitItemIds(itemIds, itemIdMap) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return null;
  }

  const mappedIds = itemIds
    .map((itemId) => itemIdMap.get(String(itemId || "").trim()))
    .filter(Boolean);
  return mappedIds.length === itemIds.length ? mappedIds : null;
}

function buildGeneratedOutfitsForReportMeta(snapshot, itemIdMap) {
  const outfitSets = snapshot?.data?.wardrobe?.outfitSets;
  if (!Array.isArray(outfitSets)) {
    return [];
  }

  const generatedOutfits = [];
  for (const [index, outfitSet] of outfitSets.entries()) {
    const itemIds = mapGeneratedOutfitItemIds(outfitSet?.itemIds, itemIdMap);
    if (!itemIds) {
      return null;
    }
    generatedOutfits.push({
      id: `outfit-set-${index + 1}`,
      itemIds,
    });
  }

  return generatedOutfits;
}

function buildCapsuleReportMeta(snapshot) {
  const reportItemsHash = getCapsuleReportItemsHash(snapshot?.report);
  if (!reportItemsHash) {
    return null;
  }

  const items = snapshot?.data?.wardrobe?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { stale: true };
  }

  const reportItems = items.map(toOutfitReportItem).filter(Boolean);
  if (reportItems.length !== items.length) {
    return { stale: true };
  }

  const itemIdMap = buildPromptItemIdMap(items);
  const generatedOutfits = buildGeneratedOutfitsForReportMeta(
    snapshot,
    itemIdMap,
  );
  if (!generatedOutfits) {
    return { stale: true };
  }
  return {
    stale:
      reportItemsHash !==
      hashCapsuleContent({
        filters: snapshot.filters,
        generatedOutfits: generatedOutfits.length
          ? generatedOutfits
          : NO_GENERATED_OUTFITS_MESSAGE,
        items: reportItems,
      }),
  };
}

function toCapsuleSnapshotResponse(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    report: snapshot.report || null,
    reportMeta: buildCapsuleReportMeta(snapshot),
  };
}

export function getCapsuleItems(capsule) {
  const effective = getEffectiveCapsuleSnapshot(capsule);
  const wardrobe = effective?.data?.wardrobe;
  return Array.isArray(wardrobe?.items)
    ? sortWardrobeItems(wardrobe.items)
    : [];
}

function annotateItemSavedState(item, savedUrls: Set<string>) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  const itemUrl = String(item.url || "").trim();
  return {
    ...item,
    isSavedToWardrobe: Boolean(itemUrl && savedUrls.has(itemUrl)),
  };
}

function annotateWardrobePayload(payload, savedUrls: Set<string>) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  if (!Array.isArray(payload.items)) {
    return payload;
  }

  return {
    ...payload,
    items: payload.items.map((item) => annotateItemSavedState(item, savedUrls)),
  };
}

function annotateCapsuleSnapshot(snapshot, savedUrls: Set<string>) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return snapshot;
  }

  const data =
    snapshot.data &&
    typeof snapshot.data === "object" &&
    !Array.isArray(snapshot.data)
      ? snapshot.data
      : null;
  const wardrobe = data
    ? annotateWardrobePayload(data.wardrobe, savedUrls)
    : null;
  const topLevelItems = Array.isArray(snapshot.items)
    ? snapshot.items.map((item) => annotateItemSavedState(item, savedUrls))
    : null;

  return {
    ...snapshot,
    ...(topLevelItems ? { items: topLevelItems } : {}),
    ...(data
      ? {
          data: {
            ...data,
            wardrobe,
          },
        }
      : {}),
  };
}

export function annotateWardrobeSavedItems(value, savedUrlsInput = []) {
  const savedUrls = new Set(
    Array.from(savedUrlsInput)
      .map((url) => String(url || "").trim())
      .filter(Boolean),
  );

  if (savedUrls.size === 0) {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const annotated = { ...value };
  for (const key of [
    "draft",
    "saved",
    "effective",
    "snapshot",
    "activeSnapshot",
  ]) {
    if (value[key]) {
      annotated[key] = annotateCapsuleSnapshot(value[key], savedUrls);
    }
  }

  if (value.data) {
    annotated.data = annotateCapsuleSnapshot(value, savedUrls).data;
  }

  if (Array.isArray(value.items)) {
    annotated.items = value.items.map((item) =>
      annotateItemSavedState(item, savedUrls),
    );
  }

  return annotated;
}
