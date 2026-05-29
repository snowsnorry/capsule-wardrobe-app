import { expandCapsuleCategoriesForAnchors } from "../../../shared/capsuleCategories.js";

type AnchorItemLike = Record<string, unknown>;

const expandCategoriesForAnchors = expandCapsuleCategoriesForAnchors;

function splitAnchorSelectionRows(items: AnchorItemLike[] = []) {
  const anchorItems = items.filter((item) => item.selection_role === "anchor");
  const candidateItems = items.filter(
    (item) => item.selection_role !== "anchor",
  );
  return { anchorItems, candidateItems };
}

function getMissingAnchorIds(
  selectedIds: string[],
  anchorItems: AnchorItemLike[],
) {
  const selected = new Set(selectedIds);
  return anchorItems
    .map((item) => String(item.id || ""))
    .filter((id) => id && !selected.has(id));
}

function getDuplicateIds(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
}

function validateAnchorSelectedIds({
  selectedIds,
  anchorItems,
  candidateItems,
}: {
  selectedIds: string[];
  anchorItems: AnchorItemLike[];
  candidateItems: AnchorItemLike[];
}) {
  if (anchorItems.length === 0) {
    return { ok: true, missingAnchorIds: [] as string[] };
  }

  const anchorIds = new Set(anchorItems.map((item) => String(item.id || "")));
  const candidateIds = new Set(
    candidateItems.map((item) => String(item.id || "")),
  );
  const missingAnchorIds = getMissingAnchorIds(selectedIds, anchorItems);
  const duplicateIds = getDuplicateIds(selectedIds);
  const unknownIds = selectedIds.filter(
    (id) => !anchorIds.has(id) && !candidateIds.has(id),
  );

  return {
    ok:
      missingAnchorIds.length === 0 &&
      duplicateIds.length === 0 &&
      unknownIds.length === 0,
    missingAnchorIds,
    duplicateIds,
    unknownIds,
  };
}

function buildAnchorRepairPrompt(missingAnchorIds: string[]) {
  return [
    "Your previous response did not include all mandatory anchor items.",
    "Return a corrected capsule that includes every anchor item exactly once and preserves all item ids exactly.",
    `Missing anchor ids: ${missingAnchorIds.join(", ")}`,
  ].join("\n");
}

export {
  buildAnchorRepairPrompt,
  expandCategoriesForAnchors,
  splitAnchorSelectionRows,
  validateAnchorSelectedIds,
};
