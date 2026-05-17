import {
  cloneEffectiveCapsuleSnapshot,
  deepClone,
  type E2eCapsuleMemory,
} from "./capsuleState.js";
import {
  hasUploadedPersonalWardrobeItems,
  normalizeCapsuleSnapshotItemsForShare,
} from "../../../shared/capsuleShareItems.js";
import { buildSharedCapsuleOgMetadata } from "../capsuleShareMetadata.js";
import {
  DEFAULT_CAPSULE_NAME,
  getCapsuleIdValue,
  isShareableCapsuleSnapshot,
  normalizeCapsuleSnapshot,
  SHARE_TTL_MS,
  type CapsuleSnapshot,
  type NormalizedCapsuleRecord,
  type SharedCapsuleMetadata,
  type SharedCapsuleOgMetadata,
  type SharedCapsuleResult,
} from "../capsuleStoreModel.js";

type E2eSharedCapsuleRecord = SharedCapsuleMetadata & {
  url: string;
  content: CapsuleSnapshot;
};

function buildLocalShareUrl(clientOrigin: string, shareId: string): string {
  const origin =
    String(clientOrigin || "").replace(/\/+$/, "") || "http://127.0.0.1:5310";
  return `${origin}/share/${encodeURIComponent(shareId)}`;
}

function buildShareExpiresAt(counter: number): string {
  return new Date(SHARE_TTL_MS + counter * 1000).toISOString();
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

function cloneShareRecord(
  share: E2eSharedCapsuleRecord | null | undefined,
): E2eSharedCapsuleRecord | null {
  return share ? deepClone(share) : null;
}

export class E2eShareMemory {
  shares = new Map<string, E2eSharedCapsuleRecord>();
  shareCounter = 0;

  reset(): void {
    this.shares.clear();
    this.shareCounter = 0;
  }

  createFromCapsule({
    capsuleId,
    capsuleMemory,
    clientOrigin,
  }: {
    capsuleId: unknown;
    capsuleMemory: E2eCapsuleMemory;
    clientOrigin: string;
  }): SharedCapsuleResult | null {
    const capsule = capsuleMemory.get(capsuleId);
    if (!capsule) {
      return null;
    }

    const content = cloneEffectiveCapsuleSnapshot(capsule);
    if (!isShareableCapsuleSnapshot(content)) {
      throwCapsuleNotShareable();
    }
    if (hasUploadedPersonalWardrobeItems(content)) {
      throwCapsuleContainsPersonalItems();
    }
    const shareContent = normalizeCapsuleSnapshotItemsForShare(content);
    if (!shareContent) {
      throwCapsuleNotShareable();
    }

    this.shareCounter += 1;
    const id = `e2e-share-${this.shareCounter}`;
    const expiresAt = buildShareExpiresAt(this.shareCounter);
    const url = buildLocalShareUrl(clientOrigin, id);
    const share: E2eSharedCapsuleRecord = {
      id,
      url,
      name: String(capsule.name || DEFAULT_CAPSULE_NAME),
      expiresAt,
      content: deepClone(shareContent),
    };
    this.shares.set(id, share);
    return { id, url, expiresAt };
  }

  getById(id: unknown): SharedCapsuleMetadata | null {
    const share = cloneShareRecord(this.shares.get(String(id || "").trim()));
    return share
      ? {
          id: share.id,
          name: share.name,
          expiresAt: share.expiresAt,
        }
      : null;
  }

  getOgMetadataById(id: unknown): SharedCapsuleOgMetadata | null {
    const share = cloneShareRecord(this.shares.get(String(id || "").trim()));
    return share
      ? buildSharedCapsuleOgMetadata({
          name: share.name,
          content: share.content,
        })
      : null;
  }

  importAsCapsule({
    capsuleMemory,
    id,
    setActiveCapsuleId,
  }: {
    capsuleMemory: E2eCapsuleMemory;
    id: unknown;
    setActiveCapsuleId: (activeCapsuleId: string | null) => void;
  }): NormalizedCapsuleRecord | null {
    const share = cloneShareRecord(this.shares.get(String(id || "").trim()));
    if (!share) {
      return null;
    }

    const content = normalizeCapsuleSnapshot(share.content);
    if (!isShareableCapsuleSnapshot(content)) {
      throwCapsuleNotShareable();
    }
    if (hasUploadedPersonalWardrobeItems(content)) {
      throwCapsuleContainsPersonalItems();
    }
    const shareContent = normalizeCapsuleSnapshotItemsForShare(content);
    if (!shareContent) {
      throwCapsuleNotShareable();
    }

    const capsule = capsuleMemory.create({
      name: share.name,
      draft: null,
      saved: shareContent,
    });
    setActiveCapsuleId(getCapsuleIdValue(capsule));
    return capsule;
  }
}
