import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type MyWardrobeItemsResponse = {
  item?: MainScreenItem;
  items?: MainScreenItem[];
};

function getItemsFromResponse(response: unknown): MainScreenItem[] {
  const items = (response as MyWardrobeItemsResponse)?.items;
  return Array.isArray(items) ? items : [];
}

function getItemFromResponse(response: unknown): MainScreenItem | null {
  const item = (response as MyWardrobeItemsResponse)?.item;
  return item && typeof item === "object" && !Array.isArray(item) ? item : null;
}

export { getItemFromResponse, getItemsFromResponse };
