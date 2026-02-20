import { API_BASE_URL } from "./config.js";
import { requestJson } from "./request.js";

async function fetchWardrobeItems() {
  return requestJson(`${API_BASE_URL}/wardrobe/items`, {
    method: "POST",
    credentials: "include"
  });
}

export { fetchWardrobeItems };
