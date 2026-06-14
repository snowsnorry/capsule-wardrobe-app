import type { MainScreenItem } from "./MainScreenTypes";

function getTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function getWardrobeItemKey(item: MainScreenItem) {
  return getTrimmedString(item?.url || item?.id);
}

function isWardrobeReportItem(item: MainScreenItem) {
  return (
    getTrimmedString(item?.source) === "uploaded" ||
    Boolean(
      getTrimmedString(item?.wardrobeId) ||
      getTrimmedString(item?.profileEmail) ||
      getTrimmedString(item?.itemSource) === "wardrobe",
    )
  );
}

function addReportCandidateId(ids: Set<string>, value: unknown) {
  const id = getTrimmedString(value);
  if (id) {
    ids.add(id);
  }
  return id;
}

function getCapsuleReportItemCandidateIds(item: MainScreenItem) {
  const ids = new Set<string>();
  const itemId = addReportCandidateId(ids, item?.id);
  const wardrobeId = addReportCandidateId(ids, item?.wardrobeId);
  addReportCandidateId(ids, item?.url);

  if (isWardrobeReportItem(item)) {
    for (const id of [itemId, wardrobeId]) {
      if (id) {
        ids.add(id.startsWith("W") ? id : `W${id}`);
      }
    }
  }

  return [...ids];
}

function getHighlightedCapsuleReportItemKeys(
  items: MainScreenItem[],
  reportItemIds: string[],
) {
  const targetIds = new Set(
    reportItemIds.map((value) => getTrimmedString(value)).filter(Boolean),
  );
  if (!targetIds.size) return [];

  return items
    .filter((item) =>
      getCapsuleReportItemCandidateIds(item).some((candidate) =>
        targetIds.has(candidate),
      ),
    )
    .map(getWardrobeItemKey)
    .filter(Boolean);
}

export { getHighlightedCapsuleReportItemKeys };
