import type { PersonalItemSource } from "../api/personalItems";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

export function filterWardrobeItemsBySource(
  items: MainScreenItem[],
  source: PersonalItemSource | null,
) {
  return source
    ? items.filter((item) => getWardrobeItemSource(item) === source)
    : items;
}

function getWardrobeItemSource(
  item: MainScreenItem,
): PersonalItemSource | null {
  const explicitSource = String(item.source || "")
    .trim()
    .toLowerCase();
  if (explicitSource === "uploaded") {
    return "uploaded";
  }
  if (explicitSource === "from_catalog") {
    return "from_catalog";
  }
  return null;
}
