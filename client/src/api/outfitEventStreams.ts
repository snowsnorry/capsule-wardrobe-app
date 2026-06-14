import type { JsonObject } from "./request";

type OutfitEventMessage = {
  data: JsonObject;
  event: string;
};
type OutfitEventSubscription = {
  outfitId?: string;
  onError?: (error: Error) => void;
  onMessage?: (message: OutfitEventMessage) => void;
  signal?: AbortSignal;
};
type EventStreamLike = {
  fetchEventSource: (
    url: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};
type OutfitEventSourceMessage = {
  data?: string;
  event?: string;
};
type OutfitStreamResponse = Pick<Response, "ok" | "status"> & {
  headers: Pick<Headers, "get">;
};

class RetriableError extends Error {}
class FatalError extends Error {}

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

function parseEventPayload(data: string | undefined): JsonObject {
  if (typeof data !== "string" || data.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(data);
  } catch {
    throw new FatalError("invalid_event_payload");
  }
}

export { FatalError, RetriableError, loadFetchEventSource, parseEventPayload };
export type {
  OutfitEventSourceMessage,
  OutfitEventSubscription,
  OutfitStreamResponse,
};
