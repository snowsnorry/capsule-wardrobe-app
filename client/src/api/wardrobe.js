import { API_BASE_URL } from "./config.js";
import { requestJson } from "./request.js";

const inFlightByKey = new Map();

async function fetchWardrobeItems({ profileKey = "default", force = false } = {}) {
  const key = String(profileKey || "default");
  const requestKey = force ? `${key}:force` : key;
  if (!inFlightByKey.has(requestKey)) {
    const promise = requestJson(`${API_BASE_URL}/wardrobe/items`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ force })
    }).finally(() => {
      inFlightByKey.delete(requestKey);
    });
    inFlightByKey.set(requestKey, promise);
  }

  return inFlightByKey.get(requestKey);
}

export { fetchWardrobeItems };
