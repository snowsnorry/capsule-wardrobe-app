import { API_BASE_URL } from "./config.js";
import { request, requestJson } from "./request.js";

const inFlightByKey = new Map();

async function fetchWardrobeItems({ profileKey = "default", force = false, capsuleId } = {}) {
  const key = String(profileKey || "default");
  const requestKey = `${capsuleId || "no-capsule"}:${force ? `${key}:force` : key}`;
  if (!inFlightByKey.has(requestKey)) {
    const promise = requestJson(`${API_BASE_URL}/wardrobe/items`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ force, capsuleId })
    }).finally(() => {
      inFlightByKey.delete(requestKey);
    });
    inFlightByKey.set(requestKey, promise);
  }

  return inFlightByKey.get(requestKey);
}

async function regenerateSelectedWardrobeItems({ itemUrls, capsuleId }) {
  while (true) {
    const response = await request(`${API_BASE_URL}/wardrobe/items/regenerate-selected`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemUrls, capsuleId })
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 202) {
      const pollAfterMs = Number(data?.pollAfterMs) > 0 ? Number(data.pollAfterMs) : 2000;
      await new Promise((resolve) => setTimeout(resolve, pollAfterMs));
      continue;
    }

    if (!response.ok) {
      const error = new Error(data?.error || data?.message || `request_failed_${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }
}

export { fetchWardrobeItems, regenerateSelectedWardrobeItems };
