import type {
  CapsuleNavItem,
  OutfitNavItem,
} from "./AppSidebarNavigationTypes";
import { sidebarPageSize } from "./AppSidebarNavigationRows";

export function getCapsuleId(capsule: CapsuleNavItem | null | undefined) {
  return String(capsule?.id || "");
}

export function getCapsuleName(capsule: CapsuleNavItem | null | undefined) {
  return String(capsule?.name || "");
}

function sortNavItemsByUpdated<T extends CapsuleNavItem>(items: T[]) {
  return [...items].sort((left, right) => {
    const pinOrder = Number(Boolean(right.pin)) - Number(Boolean(left.pin));
    if (pinOrder !== 0) return pinOrder;
    const updated = String(right.updatedAt || "").localeCompare(
      String(left.updatedAt || ""),
    );
    if (updated !== 0) return updated;
    return getCapsuleName(left).localeCompare(getCapsuleName(right));
  });
}

export function sortCapsulesByUpdated(capsules: CapsuleNavItem[]) {
  return sortNavItemsByUpdated(capsules);
}

export function sortOutfitsByUpdated(outfits: OutfitNavItem[]) {
  return sortNavItemsByUpdated(outfits);
}

export function getShowMoreCount({
  capsuleListLength,
  shouldAppendActiveCapsule,
  totalCount,
}: {
  capsuleListLength: number;
  shouldAppendActiveCapsule: boolean;
  totalCount: number;
}) {
  const adjustedRemainingCount = Math.max(
    0,
    totalCount - capsuleListLength - (shouldAppendActiveCapsule ? 1 : 0),
  );

  return Math.min(sidebarPageSize, adjustedRemainingCount);
}
