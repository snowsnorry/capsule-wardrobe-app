import { API_BASE_URL } from "./config.js";
import { request, requestJson } from "./request.js";

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

async function downloadWardrobePdf({ locale }) {
  while (true) {
    const response = await request(`${API_BASE_URL}/wardrobe/items/pdf`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ locale })
    });

    if (response.status === 202) {
      const data = await response.json().catch(() => ({}));
      const pollAfterMs = Number(data?.pollAfterMs) > 0 ? Number(data.pollAfterMs) : 2000;
      await new Promise((resolve) => setTimeout(resolve, pollAfterMs));
      continue;
    }

    if (!response.ok) {
      let message = `request_failed_${response.status}`;
      try {
        const data = await response.json();
        message = data?.error || data?.message || message;
      } catch {
        // Ignore response body parsing errors for binary endpoint failures.
      }

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "capsule-wardrobe.pdf";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  }
}

export { fetchWardrobeItems, downloadWardrobePdf };
