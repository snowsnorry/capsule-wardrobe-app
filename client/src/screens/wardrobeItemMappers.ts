import type { MyWardrobeSource } from "../api/myWardrobe";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

export function filterWardrobeItemsBySource(
  items: MainScreenItem[],
  source: MyWardrobeSource | null,
) {
  return source
    ? items.filter((item) => getWardrobeItemSource(item) === source)
    : items;
}

function getWardrobeItemSource(item: MainScreenItem): MyWardrobeSource {
  const explicitSource = String(item.source || "")
    .trim()
    .toLowerCase();
  if (explicitSource === "uploaded") {
    return "uploaded";
  }
  if (explicitSource === "from_catalog" || explicitSource === "catalog") {
    return "from_catalog";
  }
  return "from_catalog";
}
