import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type WardrobeItemsResponse = {
  item?: MainScreenItem;
  items?: MainScreenItem[];
};

function getItemsFromResponse(response: unknown): MainScreenItem[] {
  const items = (response as WardrobeItemsResponse)?.items;
  return Array.isArray(items) ? items : [];
}

function getItemFromResponse(response: unknown): MainScreenItem | null {
  const item = (response as WardrobeItemsResponse)?.item;
  return item && typeof item === "object" && !Array.isArray(item) ? item : null;
}

export { getItemFromResponse, getItemsFromResponse };
