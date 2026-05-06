import type { Dispatch, SetStateAction } from "react";
import {
  buildDisplayWardrobeItems,
  mergeWardrobeItemsIntoExistingOrder
} from "../../../shared/wardrobeMerge.js";
import { normalizeOutfitSets } from "./capsuleState";
import type {
  CapsuleMeta,
  OutfitSetSnapshot,
  StatusState,
  WardrobeItem,
  WardrobeSnapshot
} from "./appTypes";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type WardrobeSnapshotContext = {
  activeCapsuleId: string;
  closeNotificationPrompt: () => void;
  fetchCapsule: (capsuleId: string) => Promise<{ capsule?: CapsuleMeta | null }>;
  manualWardrobeRegenerationCapsuleIdRef: { current: string };
  pendingNotificationKindRef: { current: string };
  pendingRegenerationUrlsRef: { current: string[] };
  refreshCapsuleList: () => Promise<void>;
  regenerationBaseItemsRef: { current: WardrobeItem[] };
  sendReadyNotification: (kind: string) => void;
  setActiveCapsuleMeta: StateSetter<CapsuleMeta | null>;
  setHasPendingAdditionalItems: StateSetter<boolean>;
  setIsLoadingItems: StateSetter<boolean>;
  setIsPartialRegenerationLoading: StateSetter<boolean>;
  setIsWardrobePending: StateSetter<boolean>;
  setPartialRegenerationPendingUrls: StateSetter<string[]>;
  setPendingImageSetIndexes: StateSetter<number[]>;
  setProfileItems: StateSetter<WardrobeItem[] | null>;
  setProfileOutfitSets: StateSetter<OutfitSetSnapshot[]>;
  setSelectedRegenerationUrls: StateSetter<string[]>;
  setStatus: StateSetter<StatusState>;
  stopCapsuleEventStream: () => void;
  t: (key: string) => string;
};

type NormalizedWardrobeSnapshot = {
  capsuleId: string;
  hasPendingAdditionalItems: boolean;
  hasPendingOutfitSetImages: boolean;
  items: WardrobeItem[];
  outfitSets: OutfitSetSnapshot[];
  pendingImageSetIndexes: number[];
  pendingRegenerationUrls: string[];
  status: WardrobeSnapshot["status"];
};

function normalizePendingUrls(snapshot: WardrobeSnapshot | undefined) {
  return Array.isArray(snapshot?.pendingRegenerationUrls)
    ? snapshot.pendingRegenerationUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
}

function normalizePendingImageIndexes(snapshot: WardrobeSnapshot | undefined) {
  if (!Array.isArray(snapshot?.pendingImageSetIndexes)) {
    return [];
  }

  return snapshot.pendingImageSetIndexes
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value) && value >= 0);
}

function normalizeWardrobeSnapshot(
  snapshot: WardrobeSnapshot | undefined,
  capsuleId: string | undefined
): NormalizedWardrobeSnapshot {
  const pendingImageSetIndexes = normalizePendingImageIndexes(snapshot);
  return {
    capsuleId: String(capsuleId || "").trim(),
    hasPendingAdditionalItems: Boolean(snapshot?.hasPendingAdditionalItems),
    hasPendingOutfitSetImages: pendingImageSetIndexes.length > 0,
    items: Array.isArray(snapshot?.items) ? snapshot.items : [],
    outfitSets: normalizeOutfitSets(snapshot?.outfitSets),
    pendingImageSetIndexes,
    pendingRegenerationUrls: normalizePendingUrls(snapshot),
    status: snapshot?.status
  };
}

function clearPendingRefs(context: WardrobeSnapshotContext) {
  context.pendingRegenerationUrlsRef.current = [];
  context.regenerationBaseItemsRef.current = [];
}

function renderItems(items: WardrobeItem[]) {
  return buildDisplayWardrobeItems(items) as WardrobeItem[];
}

function applyFailedWardrobeSnapshot(
  context: WardrobeSnapshotContext,
  snapshot: NormalizedWardrobeSnapshot
) {
  context.manualWardrobeRegenerationCapsuleIdRef.current = "";
  context.pendingNotificationKindRef.current = "";
  context.closeNotificationPrompt();
  context.stopCapsuleEventStream();
  context.setProfileItems(renderItems(snapshot.items));
  context.setProfileOutfitSets(snapshot.outfitSets);
  context.setSelectedRegenerationUrls([]);
  clearPendingRefs(context);
  context.setPartialRegenerationPendingUrls([]);
  context.setIsPartialRegenerationLoading(false);
  context.setIsWardrobePending(false);
  context.setHasPendingAdditionalItems(false);
  context.setIsLoadingItems(false);
  context.setPendingImageSetIndexes(snapshot.pendingImageSetIndexes);
  context.setStatus((current) => ({
    ...current,
    error: context.t("errors.regenerateAllFailed")
  }));
}

function applyPendingWardrobeSnapshot(
  context: WardrobeSnapshotContext,
  snapshot: NormalizedWardrobeSnapshot
) {
  context.setProfileItems((currentItems) => (
    snapshot.pendingRegenerationUrls.length > 0
      ? mergeWardrobeItemsIntoExistingOrder({
        currentItems,
        nextItems: snapshot.items,
        pendingUrls: snapshot.pendingRegenerationUrls
      }) as WardrobeItem[]
      : renderItems(snapshot.items)
  ));
  context.setSelectedRegenerationUrls([]);
  context.pendingRegenerationUrlsRef.current = snapshot.pendingRegenerationUrls;
  context.setPartialRegenerationPendingUrls(snapshot.pendingRegenerationUrls);
  context.setIsPartialRegenerationLoading(snapshot.pendingRegenerationUrls.length > 0);
  context.setProfileOutfitSets(snapshot.outfitSets);
  context.setPendingImageSetIndexes(snapshot.pendingImageSetIndexes);
  context.setIsWardrobePending(true);
  context.setHasPendingAdditionalItems(snapshot.hasPendingAdditionalItems);
  context.setIsLoadingItems(snapshot.items.length === 0 && !snapshot.hasPendingAdditionalItems);
}

function mergeReadyItems(context: WardrobeSnapshotContext, items: WardrobeItem[]) {
  const pendingUrls = context.pendingRegenerationUrlsRef.current;
  const baseItems = pendingUrls.length > 0 ? context.regenerationBaseItemsRef.current : [];
  context.setProfileItems((currentItems) => (
    pendingUrls.length > 0
      ? mergeWardrobeItemsIntoExistingOrder({
        currentItems: baseItems.length > 0 ? baseItems : currentItems,
        nextItems: items,
        pendingUrls
      }) as WardrobeItem[]
      : renderItems(items)
  ));
}

async function refreshReadyCapsule(
  context: WardrobeSnapshotContext,
  snapshot: NormalizedWardrobeSnapshot
) {
  const notificationKind = context.pendingNotificationKindRef.current;
  if (notificationKind) {
    context.sendReadyNotification(notificationKind);
  }
  context.pendingNotificationKindRef.current = "";
  context.closeNotificationPrompt();

  try {
    const capsuleResult = await context.fetchCapsule(snapshot.capsuleId);
    context.setActiveCapsuleMeta(capsuleResult.capsule || null);
    await context.refreshCapsuleList();
  } catch {
    // Keep rendered items even if sidebar metadata refresh fails.
  }
}

async function applyReadyWardrobeSnapshot(
  context: WardrobeSnapshotContext,
  snapshot: NormalizedWardrobeSnapshot
) {
  mergeReadyItems(context, snapshot.items);
  context.setSelectedRegenerationUrls([]);
  clearPendingRefs(context);
  context.setProfileOutfitSets(snapshot.outfitSets);
  context.setPendingImageSetIndexes(snapshot.pendingImageSetIndexes);
  context.setPartialRegenerationPendingUrls([]);
  context.setIsPartialRegenerationLoading(false);
  context.setIsWardrobePending(false);
  context.setHasPendingAdditionalItems(false);
  context.setIsLoadingItems(false);

  if (snapshot.status !== "pending" && !snapshot.hasPendingOutfitSetImages) {
    context.manualWardrobeRegenerationCapsuleIdRef.current = "";
    context.stopCapsuleEventStream();
  }

  if (snapshot.status === "ready" && !snapshot.hasPendingOutfitSetImages && snapshot.capsuleId) {
    await refreshReadyCapsule(context, snapshot);
  }
}

export async function applyWardrobeSnapshotToApp(
  context: WardrobeSnapshotContext,
  snapshot: WardrobeSnapshot | undefined,
  capsuleId: string | undefined = context.activeCapsuleId
) {
  const normalized = normalizeWardrobeSnapshot(snapshot, capsuleId);

  if (normalized.status === "failed") {
    applyFailedWardrobeSnapshot(context, normalized);
    return;
  }

  if (normalized.status === "pending") {
    applyPendingWardrobeSnapshot(context, normalized);
    return;
  }

  await applyReadyWardrobeSnapshot(context, normalized);
}
