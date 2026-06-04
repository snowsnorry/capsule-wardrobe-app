import {
  hasUploadedPersonalWardrobeItems,
  normalizeCapsuleSnapshotItemsForShare,
} from "../../shared/capsuleShareItems.js";
import {
  DEFAULT_CAPSULE_NAME,
  SHARE_TTL_MS,
  isShareableCapsuleSnapshot,
  normalizeCapsuleSnapshot,
  type NormalizedCapsuleRecord,
  type SharedCapsuleMetadata,
  type SharedCapsuleOgMetadata,
  type SharedCapsuleResult,
} from "./capsuleStoreModel.js";
import { buildSharedCapsuleOgMetadata } from "./capsuleShareMetadata.js";

function buildShareUrl(clientOrigin: string, shareId: string): string {
  const origin =
    String(clientOrigin || "").replace(/\/+$/, "") || "http://localhost:5173";
  return `${origin}/share/${encodeURIComponent(shareId)}`;
}

export async function createCapsuleShareForStore({
  email,
  capsuleId,
  clientOrigin,
  getCapsuleImpl,
  pruneExpiredSharedCapsulesImpl,
  nowImpl,
  upsertSharedCapsuleImpl,
  hashCapsuleContentImpl,
}: {
  email: string;
  capsuleId: string;
  clientOrigin: string;
  getCapsuleImpl: (
    email: string,
    capsuleId: string,
  ) => Promise<NormalizedCapsuleRecord | null>;
  pruneExpiredSharedCapsulesImpl: () => Promise<void>;
  nowImpl: () => number;
  upsertSharedCapsuleImpl;
  hashCapsuleContentImpl: (content: unknown) => string;
}): Promise<SharedCapsuleResult | null> {
  const capsule = await getCapsuleImpl(email, capsuleId);
  if (!capsule) {
    return null;
  }

  const snapshot = capsule.draft || capsule.saved || null;
  if (!isShareableCapsuleSnapshot(snapshot)) {
    throwCapsuleNotShareable();
  }
  if (hasUploadedPersonalWardrobeItems(snapshot)) {
    throwCapsuleContainsPersonalItems();
  }
  const shareSnapshot = normalizeCapsuleSnapshotItemsForShare(snapshot);
  if (!shareSnapshot) {
    throwCapsuleNotShareable();
  }

  await pruneExpiredSharedCapsulesImpl();
  const expiresAt = new Date(nowImpl() + SHARE_TTL_MS);
  const shared = await upsertSharedCapsuleImpl({
    profileEmail: email,
    name: String(capsule.name || DEFAULT_CAPSULE_NAME),
    content: shareSnapshot as unknown as Record<string, unknown>,
    contentHash: hashCapsuleContentImpl(shareSnapshot),
    expiresAt,
  });

  return shared
    ? {
        id: shared.id,
        url: buildShareUrl(clientOrigin, shared.id),
        expiresAt: shared.expiresAt,
      }
    : null;
}

export async function getSharedCapsuleForStore({
  id,
  getValidSharedCapsuleByIdImpl,
  pruneExpiredSharedCapsulesImpl,
}: {
  id: string;
  getValidSharedCapsuleByIdImpl;
  pruneExpiredSharedCapsulesImpl: () => Promise<void>;
}): Promise<SharedCapsuleMetadata | null> {
  const shared = await getValidSharedCapsuleByIdImpl(String(id || "").trim());
  if (!shared) {
    await pruneExpiredSharedCapsulesImpl();
    return null;
  }

  return {
    id: shared.id,
    name: shared.name,
    expiresAt: shared.expiresAt,
  };
}

export async function getSharedCapsuleOgMetadataForStore({
  id,
  getValidSharedCapsuleByIdImpl,
  pruneExpiredSharedCapsulesImpl,
}: {
  id: string;
  getValidSharedCapsuleByIdImpl;
  pruneExpiredSharedCapsulesImpl: () => Promise<void>;
}): Promise<SharedCapsuleOgMetadata | null> {
  const shared = await getValidSharedCapsuleByIdImpl(String(id || "").trim());
  if (!shared) {
    await pruneExpiredSharedCapsulesImpl();
    return null;
  }

  return buildSharedCapsuleOgMetadata({
    name: shared.name,
    content: shared.content,
  });
}

export async function importSharedCapsuleForStore({
  email,
  id,
  getValidSharedCapsuleByIdImpl,
  pruneExpiredSharedCapsulesImpl,
  createCapsuleImpl,
}: {
  email: string;
  id: string;
  getValidSharedCapsuleByIdImpl;
  pruneExpiredSharedCapsulesImpl: () => Promise<void>;
  createCapsuleImpl: (
    email: string,
    options,
  ) => Promise<NormalizedCapsuleRecord | null>;
}): Promise<NormalizedCapsuleRecord | null> {
  const shared = await getValidSharedCapsuleByIdImpl(String(id || "").trim());
  if (!shared) {
    await pruneExpiredSharedCapsulesImpl();
    return null;
  }

  const content = normalizeCapsuleSnapshot(shared.content);
  if (!isShareableCapsuleSnapshot(content)) {
    throwCapsuleNotShareable();
  }
  if (hasUploadedPersonalWardrobeItems(content)) {
    throwCapsuleContainsPersonalItems();
  }

  const shareableContent = normalizeCapsuleSnapshotItemsForShare(content);
  if (!shareableContent) {
    throwCapsuleNotShareable();
  }

  return createCapsuleImpl(email, {
    name: shared.name,
    draft: null,
    saved: shareableContent,
  });
}

function throwCapsuleNotShareable(): never {
  const error = new Error("capsule_not_shareable");
  (error as Error & { code?: string }).code = "capsule_not_shareable";
  throw error;
}

function throwCapsuleContainsPersonalItems(): never {
  const error = new Error("capsule_contains_personal_items");
  (error as Error & { code?: string }).code = "capsule_contains_personal_items";
  throw error;
}
