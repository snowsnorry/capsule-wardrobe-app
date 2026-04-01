import { API_BASE_URL } from "./config.js";
import { request, requestJson } from "./request.js";

const inFlightByKey = new Map();

async function fetchCapsuleItems({ profileKey = "default", capsuleId } = {}) {
  const key = String(profileKey || "default");
  const normalizedCapsuleId = String(capsuleId || "").trim();
  const requestKey = `${normalizedCapsuleId || "no-capsule"}:${key}`;
  if (!inFlightByKey.has(requestKey)) {
    const promise = requestJson(`${API_BASE_URL}/capsules/${normalizedCapsuleId}/items`, {
      credentials: "include"
    }).finally(() => {
      inFlightByKey.delete(requestKey);
    });
    inFlightByKey.set(requestKey, promise);
  }

  return inFlightByKey.get(requestKey);
}

async function regenerateCapsuleWardrobe({ capsuleId }) {
  return requestJson(`${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate`, {
    method: "POST",
    credentials: "include"
  });
}

async function regenerateSelectedWardrobeItems({ itemUrls, capsuleId }) {
  while (true) {
    const response = await request(`${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate-selected`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemUrls })
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

export { fetchCapsuleItems, regenerateCapsuleWardrobe, regenerateSelectedWardrobeItems };
