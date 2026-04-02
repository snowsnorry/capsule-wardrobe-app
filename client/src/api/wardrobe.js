import { fetchEventSource } from "@microsoft/fetch-event-source";
import { API_BASE_URL } from "./config.js";
import { requestJson } from "./request.js";

class RetriableError extends Error {}
class FatalError extends Error {}

function parseEventPayload(data) {
  if (typeof data !== "string" || data.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(data);
  } catch {
    throw new FatalError("invalid_event_payload");
  }
}

async function subscribeCapsuleEvents({
  capsuleId,
  signal,
  onMessage = () => {},
  onError = () => {}
} = {}) {
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return fetchEventSource(`${API_BASE_URL}/capsules/${normalizedCapsuleId}/events`, {
    credentials: "include",
    signal,
    openWhenHidden: true,
    async onopen(response) {
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (response.ok && contentType.includes("text/event-stream")) {
        return;
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new FatalError(`request_failed_${response.status}`);
      }

      throw new RetriableError(`request_failed_${response.status}`);
    },
    onmessage(event) {
      onMessage({
        event: event.event || "message",
        data: parseEventPayload(event.data)
      });
    },
    onclose() {
      throw new RetriableError("event_stream_closed");
    },
    onerror(error) {
      if (signal?.aborted) {
        return undefined;
      }

      if (error instanceof FatalError) {
        onError(error);
        throw error;
      }

      return 1000;
    }
  });
}

async function regenerateCapsuleWardrobe({ capsuleId }) {
  return requestJson(`${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate`, {
    method: "POST",
    credentials: "include"
  });
}

async function regenerateSelectedWardrobeItems({ itemUrls, capsuleId }) {
  return requestJson(`${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate-selected`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ itemUrls })
  });
}

export { regenerateCapsuleWardrobe, regenerateSelectedWardrobeItems, subscribeCapsuleEvents };
