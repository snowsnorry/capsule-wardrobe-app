import { createHash } from "node:crypto";

type NormalizeOwnedWardrobeR2KeysInput = {
  email: string;
  keys?: unknown[] | null;
};

function buildWardrobeOwnedR2KeyPrefix(email: string): string {
  const profileHash = createHash("sha256")
    .update(
      String(email || "")
        .trim()
        .toLowerCase(),
    )
    .digest("hex")
    .slice(0, 16);
  return `wardrobe/${profileHash || "profile"}/`;
}

function isUnsafeR2KeySegment(segment: string): boolean {
  return !segment || segment === "." || segment === "..";
}

function normalizeOwnedWardrobeR2Keys({
  email,
  keys = [],
}: NormalizeOwnedWardrobeR2KeysInput): string[] {
  const prefix = buildWardrobeOwnedR2KeyPrefix(email);
  const seen = new Set<string>();
  const normalizedKeys: string[] = [];

  for (const value of Array.isArray(keys) ? keys : []) {
    const key = String(value || "").trim();
    if (
      !key ||
      key.includes("://") ||
      key.startsWith("/") ||
      key.includes("\\") ||
      !key.startsWith(prefix)
    ) {
      continue;
    }

    const segments = key.split("/");
    if (segments.some(isUnsafeR2KeySegment) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedKeys.push(key);
  }

  return normalizedKeys;
}

function mergeOwnedWardrobeR2Keys({
  email,
  existingKeys = [],
  newKeys = [],
}: {
  email: string;
  existingKeys?: unknown[] | null;
  newKeys?: unknown[] | null;
}): string[] {
  return normalizeOwnedWardrobeR2Keys({
    email,
    keys: [...(existingKeys || []), ...(newKeys || [])],
  });
}

function getOwnedWardrobeR2KeysFromItem(
  item: unknown,
  email: string,
): string[] {
  const keys =
    typeof item === "object" && item !== null
      ? (item as { ownedR2ImageKeys?: unknown[] | null }).ownedR2ImageKeys
      : [];
  return normalizeOwnedWardrobeR2Keys({ email, keys });
}

export {
  buildWardrobeOwnedR2KeyPrefix,
  getOwnedWardrobeR2KeysFromItem,
  mergeOwnedWardrobeR2Keys,
  normalizeOwnedWardrobeR2Keys,
};
