import { API_BASE_URL } from "./config.js";
import { requestJson } from "./request.js";

const inFlightByKey = new Map();

async function fetchWardrobeItems(profileKey = "default") {
  const key = String(profileKey || "default");
  if (!inFlightByKey.has(key)) {
    const promise = requestJson(`${API_BASE_URL}/wardrobe/items`, {
    method: "POST",
    credentials: "include"
    }).finally(() => {
      inFlightByKey.delete(key);
    });
    inFlightByKey.set(key, promise);
  }

  return inFlightByKey.get(key);
}

export { fetchWardrobeItems };
