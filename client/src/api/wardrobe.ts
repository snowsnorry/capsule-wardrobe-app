import { API_BASE_URL } from "./config";
import { requestJson } from "./request";
import { parseTrackedJobResponse, type JobResponse } from "./jobs";
import type { JsonObject } from "./request";

class RetriableError extends Error {}
class FatalError extends Error {}

type WardrobeResponse = JsonObject;
type EventPayload = JsonObject;
type EventMessage = {
  data: EventPayload;
  event: string;
};
type EventStreamLike = {
  fetchEventSource: (
    url: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};
type CapsuleEventMessage = {
  data?: string;
  event?: string;
};
type CapsuleStreamResponse = Pick<Response, "ok" | "status"> & {
  headers: Pick<Headers, "get">;
};
type CapsuleEventSubscription = {
  capsuleId?: string;
  onError?: (error: Error) => void;
  onMessage?: (message: EventMessage) => void;
  signal?: AbortSignal;
};
type WardrobeMutationInput = {
  capsuleId?: string;
};
type SelectedWardrobeMutationInput = WardrobeMutationInput & {
  itemUrls: string[];
};
type OutfitSetMutationInput = WardrobeMutationInput & {
  setIndex?: number | string;
};

let fetchEventSourcePromise: Promise<
  EventStreamLike["fetchEventSource"]
> | null = null;

function loadFetchEventSource(): Promise<EventStreamLike["fetchEventSource"]> {
  if (!fetchEventSourcePromise) {
    fetchEventSourcePromise = import("@microsoft/fetch-event-source").then(
      (module) => module.fetchEventSource,
    );
  }

  return fetchEventSourcePromise;
}

function parseEventPayload(data: string | undefined): EventPayload {
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
  onError = () => {},
}: CapsuleEventSubscription = {}): Promise<unknown> {
  const normalizedCapsuleId = String(capsuleId || "").trim();
  const fetchEventSource = await loadFetchEventSource();
  return fetchEventSource(
    `${API_BASE_URL}/capsules/${normalizedCapsuleId}/events`,
    {
      credentials: "include",
      signal,
      openWhenHidden: true,
      async onopen(response: CapsuleStreamResponse) {
        const contentType = (
          response.headers.get("content-type") || ""
        ).toLowerCase();
        if (response.ok && contentType.includes("text/event-stream")) {
          return;
        }

        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw new FatalError(`request_failed_${response.status}`);
        }

        throw new RetriableError(`request_failed_${response.status}`);
      },
      onmessage(event: CapsuleEventMessage) {
        onMessage({
          event: event.event || "message",
          data: parseEventPayload(event.data),
        });
      },
      onclose() {
        throw new RetriableError("event_stream_closed");
      },
      onerror(error: Error) {
        if (signal?.aborted) {
          return undefined;
        }

        if (error instanceof FatalError) {
          onError(error);
          throw error;
        }

        return 1000;
      },
    },
  );
}

async function regenerateCapsuleWardrobe({
  capsuleId,
}: WardrobeMutationInput): Promise<JobResponse> {
  return parseTrackedJobResponse(
    await requestJson(
      `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate`,
      {
        method: "POST",
        credentials: "include",
      },
    ),
  );
}

async function regenerateSelectedWardrobeItems({
  itemUrls,
  capsuleId,
}: SelectedWardrobeMutationInput): Promise<JobResponse> {
  return parseTrackedJobResponse(
    await requestJson(
      `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate-selected`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemUrls }),
      },
    ),
  );
}

async function generateOutfitSetImage({
  capsuleId,
  setIndex,
}: OutfitSetMutationInput): Promise<WardrobeResponse> {
  return requestJson(
    `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/outfit-sets/${Number.parseInt(String(setIndex ?? ""), 10)}/image`,
    {
      method: "POST",
      credentials: "include",
    },
  );
}

async function deleteOutfitSetImage({
  capsuleId,
  setIndex,
}: OutfitSetMutationInput): Promise<WardrobeResponse> {
  return requestJson(
    `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/outfit-sets/${Number.parseInt(String(setIndex ?? ""), 10)}/image`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
}

export {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
  subscribeCapsuleEvents,
};
