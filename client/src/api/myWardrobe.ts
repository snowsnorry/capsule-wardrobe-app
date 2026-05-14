import { API_BASE_URL } from "./config";
import { getCachedJson, requestJson } from "./request";
import type { JsonObject } from "./request";

type MyWardrobeSource = "uploaded" | "from_catalog";
type MyWardrobeFetchOptions = {
  source?: MyWardrobeSource | null;
};

function getWardrobeItemsUrl({ source = null }: MyWardrobeFetchOptions = {}) {
  const params = new URLSearchParams();
  if (source) {
    params.set("source", source);
  }
  const query = params.toString();
  return `${API_BASE_URL}/wardrobe/items${query ? `?${query}` : ""}`;
}

async function fetchMyWardrobeItems(
  options: MyWardrobeFetchOptions = {},
): Promise<JsonObject> {
  return getCachedJson(getWardrobeItemsUrl(options), {
    credentials: "include",
  });
}

async function saveCatalogItemToMyWardrobe(url: string): Promise<JsonObject> {
  return requestJson(`${API_BASE_URL}/wardrobe/items/from-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
}

async function removeCatalogItemFromMyWardrobe(
  url: string,
): Promise<JsonObject> {
  return requestJson(`${API_BASE_URL}/wardrobe/items/from-catalog`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
}

export {
  fetchMyWardrobeItems,
  getWardrobeItemsUrl,
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
};
export type { MyWardrobeSource };
