import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type { NameDialogState } from "../mainScreen/MainScreenDialogsTypes";
import { getCanonicalItemUrl } from "../../utils/likedItemState";
import {
  getOutfitItem,
  getOutfitItemKey,
  getPreviewItemKey,
} from "./outfitItemMappers";

export function getPreviewComparableKey(item: WardrobeItem) {
  return getCanonicalItemUrl(item) || getPreviewItemKey(item);
}

export function makeOutfitNameDialog(
  type: "rename" | "save-as",
  outfit: { id?: string; name?: string } | null | undefined,
): NameDialogState {
  return {
    type,
    capsuleId: outfit?.id || "",
    value: outfit?.name || "",
  };
}

function getTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function isWardrobeReportItem(
  entry: OutfitItemSnapshot,
  item: WardrobeItem | null | undefined,
) {
  if (entry.source === "uploaded") {
    return true;
  }

  if (getTrimmedString(item?.source) === "uploaded") {
    return true;
  }

  if (getTrimmedString(item?.itemSource) === "wardrobe") {
    return true;
  }

  return Boolean(
    getTrimmedString(item?.wardrobeId) || getTrimmedString(item?.profileEmail),
  );
}

function addReportCandidateId(ids: Set<string>, value: unknown) {
  const id = getTrimmedString(value);
  if (id) {
    ids.add(id);
  }
  return id;
}

function getReportItemCandidateIds(entry: OutfitItemSnapshot) {
  const item = getOutfitItem(entry);
  const ids = new Set<string>();
  addReportCandidateId(ids, entry.url);
  const itemId = addReportCandidateId(ids, item?.id);
  const wardrobeId = addReportCandidateId(ids, item?.wardrobeId);
  addReportCandidateId(ids, item?.url);

  if (isWardrobeReportItem(entry, item)) {
    for (const id of [itemId, wardrobeId]) {
      if (id) {
        ids.add(id.startsWith("W") ? id : `W${id}`);
      }
    }
  }

  return [...ids];
}

export function getHighlightedReportItemKeys(
  entries: OutfitItemSnapshot[],
  reportItemIds: string[],
) {
  const targetIds = new Set(
    reportItemIds.map((value) => String(value || "").trim()).filter(Boolean),
  );
  if (!targetIds.size) return [];

  return entries
    .filter((entry) =>
      getReportItemCandidateIds(entry).some((candidate) =>
        targetIds.has(candidate),
      ),
    )
    .map(getOutfitItemKey)
    .filter(Boolean);
}
