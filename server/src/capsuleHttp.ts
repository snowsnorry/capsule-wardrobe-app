import {
  buildSnapshotFromProfile,
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleSnapshot
} from "./capsuleStore.js";
import type { WardrobeUiItemLike } from "./ai/types.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";

type RejectedUrlsValidationResult =
  | { error: "invalid_payload" | "not_found" }
  | { rejectedUrls: string[] };

export function buildPdfDownloadFilename(capsuleName) {
  const normalizedName = String(capsuleName || "")
    .replaceAll(
      /[\s\S]/g,
      (char) => (char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f ? " " : char)
    )
    .replace(/[\\/:"*?<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const baseName = normalizedName || "capsule-wardrobe";
  const asciiFallback = baseName
    .replace(/[^\x20-\x7e]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    || "capsule-wardrobe";
  const encodedUtf8Name = encodeURIComponent(`${baseName}.pdf`);
  return `attachment; filename="${asciiFallback}.pdf"; filename*=UTF-8''${encodedUtf8Name}`;
}

export function isApiPath(pathname = "") {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/capsules") ||
    pathname.startsWith("/shared-capsules") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/wardrobe") ||
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
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
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
    filters
  })?.filters;

  return {
    filters: normalizedFilters || buildSnapshotFromProfile(profile)?.filters,
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  };
}

export function getValidatedRejectedUrls(capsule, rejectedUrls): RejectedUrlsValidationResult | null {
  if (!Array.isArray(rejectedUrls)) {
    return null;
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const wardrobeItems: WardrobeUiItemLike[] = Array.isArray(effectiveSnapshot?.data?.wardrobe?.items)
    ? effectiveSnapshot.data.wardrobe.items as WardrobeUiItemLike[]
    : [];

  if (wardrobeItems.length === 0) {
    return { error: "not_found" };
  }

  const allowedUrls = new Set(
    wardrobeItems
      .map((item) => String(item?.url || "").trim())
      .filter(Boolean)
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
    filters: effective?.filters || null
  };
}

export function toCapsuleResponse(capsule) {
  return {
    ...toCapsuleSummary(capsule),
    draft: capsule.draft,
    saved: capsule.saved,
    effective: getEffectiveCapsuleSnapshot(capsule)
  };
}

export function getCapsuleItems(capsule) {
  const effective = getEffectiveCapsuleSnapshot(capsule);
  const wardrobe = effective?.data?.wardrobe;
  return Array.isArray(wardrobe?.items) ? sortWardrobeItems(wardrobe.items) : [];
}

