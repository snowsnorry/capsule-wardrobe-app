import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type WardrobeDeletionTarget =
  | { kind: "uploaded"; id: string }
  | { kind: "from_catalog"; url: string };

function getWardrobeDeletionTarget(
  item: MainScreenItem,
): WardrobeDeletionTarget | null {
  const id = String(item?.id || "").trim();
  const url = String(item?.url || "").trim();
  if (item?.source === "uploaded") {
    return id ? { kind: "uploaded", id } : null;
  }

  return url ? { kind: "from_catalog", url } : null;
}

function isDifferentWardrobeItem(
  currentItem: MainScreenItem,
  item: MainScreenItem,
  target: WardrobeDeletionTarget,
) {
  if (currentItem === item) {
    return false;
  }

  return target.kind === "uploaded"
    ? String(currentItem?.id || "").trim() !== target.id
    : String(currentItem?.url || "").trim() !== target.url;
}

export { getWardrobeDeletionTarget, isDifferentWardrobeItem };
