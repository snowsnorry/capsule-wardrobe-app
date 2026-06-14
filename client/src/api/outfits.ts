import { requestJson } from "./request";
import type { JsonObject } from "./request";
import {
  buildOutfitListQuery,
  outfitIdPath,
  outfitUrl,
  type OutfitListOptions,
} from "./outfitApiPaths";
import { toOutfitItemRefs, type OutfitItemSnapshot } from "./outfitItemRefs";
import {
  FatalError,
  RetriableError,
  loadFetchEventSource,
  parseEventPayload,
  type OutfitEventSourceMessage,
  type OutfitEventSubscription,
  type OutfitStreamResponse,
} from "./outfitEventStreams";
export { generateOutfitReport } from "./outfitReportApi";
export { downloadOutfitPdf } from "./outfitPdfApi";

type OutfitResponse = JsonObject;
type OutfitImageSourceInput = {
  sourceCapsuleId?: string;
  sourceSetIndex?: number;
};

async function fetchOutfitBootstrap(): Promise<OutfitResponse> {
  return requestJson(outfitUrl("/bootstrap"), {
    credentials: "include",
  });
}

async function fetchRecentOutfits(
  options: OutfitListOptions = {},
): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`/recent${buildOutfitListQuery(options)}`), {
    credentials: "include",
  });
}

async function searchOutfits(query: string): Promise<OutfitResponse> {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  const url = encodedQuery
    ? `${outfitUrl("/search")}?q=${encodedQuery}`
    : outfitUrl("/search");
  return requestJson(url, {
    credentials: "include",
  });
}

async function fetchOutfit(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(outfitIdPath(id)), {
    credentials: "include",
  });
}

async function subscribeOutfitEvents({
  outfitId,
  signal,
  onMessage = () => {},
  onError = () => {},
}: OutfitEventSubscription = {}): Promise<unknown> {
  const normalizedOutfitId = String(outfitId || "").trim();
  const fetchEventSource = await loadFetchEventSource();
  return fetchEventSource(
    outfitUrl(`${outfitIdPath(normalizedOutfitId)}/events`),
    {
      credentials: "include",
      signal,
      openWhenHidden: true,
      async onopen(response: OutfitStreamResponse) {
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
      onmessage(event: OutfitEventSourceMessage) {
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

async function createOutfit({
  name,
  items = [],
  sourceCapsuleId,
  sourceSetIndex,
}: {
  name?: string;
  items?: OutfitItemSnapshot[];
} & OutfitImageSourceInput = {}): Promise<OutfitResponse> {
  return requestJson(outfitUrl(""), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(typeof name === "string" && name.trim() ? { name } : {}),
      items: toOutfitItemRefs(items),
      ...(sourceCapsuleId ? { sourceCapsuleId } : {}),
      ...(Number.isInteger(sourceSetIndex) ? { sourceSetIndex } : {}),
    }),
  });
}

async function updateOutfitItems(
  id: string,
  items: OutfitItemSnapshot[],
): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/items`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: toOutfitItemRefs(items) }),
  });
}

async function saveOutfit(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/save`), {
    method: "POST",
    credentials: "include",
  });
}

async function revertOutfit(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/revert`), {
    method: "POST",
    credentials: "include",
  });
}

async function renameOutfit(id: string, name: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/rename`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

async function duplicateOutfit(
  id: string,
  name?: string,
): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/duplicate`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
}

async function selectOutfit(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/select`), {
    method: "POST",
    credentials: "include",
  });
}

async function deleteOutfit(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(outfitIdPath(id)), {
    method: "DELETE",
    credentials: "include",
  });
}

async function generateOutfitImage(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/image`), {
    method: "POST",
    credentials: "include",
  });
}

async function deleteOutfitImage(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/image`), {
    method: "DELETE",
    credentials: "include",
  });
}

async function deleteOutfitReport(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/report`), {
    method: "DELETE",
    credentials: "include",
  });
}

export {
  createOutfit,
  deleteOutfit,
  deleteOutfitImage,
  deleteOutfitReport,
  duplicateOutfit,
  fetchOutfit,
  fetchOutfitBootstrap,
  fetchRecentOutfits,
  generateOutfitImage,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  subscribeOutfitEvents,
  updateOutfitItems,
};
