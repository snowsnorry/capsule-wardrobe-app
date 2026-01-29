import { API_BASE_URL } from "./config.js";
import { getCachedJson } from "./request.js";

async function fetchWardrobeItems() {
  return getCachedJson(`${API_BASE_URL}/wardrobe/items`, {
    credentials: "include",
    ttlMs: 1000
  });
}

export { fetchWardrobeItems };
