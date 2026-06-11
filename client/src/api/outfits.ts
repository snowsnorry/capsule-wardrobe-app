/* eslint-disable max-lines */
import { API_BASE_URL } from "./config";
import { getCsrfHeader, request, requestJson } from "./request";
import type { JsonObject } from "./request";
import type { OutfitReport } from "../app/appTypes";

type OutfitResponse = JsonObject;
type OutfitReportResponse = {
  ok: true;
  report: OutfitReport;
};
type OutfitListOptions = {
  limit?: number;
  offset?: number;
};
type OutfitItemSnapshot = Record<string, unknown>;
type OutfitItemRef = { url: string; source: "uploaded" | "from_catalog" };
type OutfitImageSourceInput = {
  sourceCapsuleId?: string;
  sourceSetIndex?: number;
};
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
type OutfitReportStreamResponse = OutfitStreamResponse;
type RequestErrorWithStatus = Error & {
  status: number;
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

function outfitUrl(path = ""): string {
  return `${API_BASE_URL}/outfits${path}`;
}

function outfitIdPath(id: string): string {
  return `/${encodeURIComponent(String(id || "").trim())}`;
}

function buildOutfitListQuery({ limit, offset }: OutfitListOptions = {}) {
  const params = new URLSearchParams();
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function getSnapshotUrl(item: OutfitItemSnapshot) {
  const nestedItem = item?.item;
  return String(
    item?.url ||
      (nestedItem && typeof nestedItem === "object" && "url" in nestedItem
        ? nestedItem.url
        : "") ||
      "",
  ).trim();
}

function normalizeOutfitItemSource(source: unknown) {
  return source === "uploaded" || source === "from_catalog" ? source : null;
}

function getSnapshotSource(item: OutfitItemSnapshot) {
  const nestedItem = item?.item;
  return (
    normalizeOutfitItemSource(item?.source) ||
    (nestedItem && typeof nestedItem === "object" && "source" in nestedItem
      ? normalizeOutfitItemSource(nestedItem.source)
      : null) ||
    "from_catalog"
  );
}

function toOutfitItemRef(item: OutfitItemSnapshot): OutfitItemRef | null {
  const url = getSnapshotUrl(item);
  const source = getSnapshotSource(item);
  return url ? { url, source } : null;
}

function toOutfitItemRefs(items: OutfitItemSnapshot[] = []) {
  return items
    .map(toOutfitItemRef)
    .filter((item): item is OutfitItemRef => Boolean(item));
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

function getDownloadFilenameFromDisposition(
  contentDisposition?: string | null,
): string {
  const header = String(contentDisposition || "");
  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // ignore malformed filename*
    }
  }

  const filenameMatch = header.match(
    /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i,
  );
  return (
    (filenameMatch?.[1] || filenameMatch?.[2] || "").trim() ||
    "capsule-wardrobe.pdf"
  );
}

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

async function generateOutfitReport(id: string): Promise<OutfitReportResponse> {
  const fetchEventSource = await loadFetchEventSource();
  let completePayload: OutfitReportResponse | null = null;

  await fetchEventSource(outfitUrl(`${outfitIdPath(id)}/report`), {
    method: "POST",
    credentials: "include",
    headers: getCsrfHeader(),
    openWhenHidden: true,
    async onopen(response: OutfitReportStreamResponse) {
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (response.ok && contentType.includes("text/event-stream")) {
        return;
      }

      throw new FatalError(`request_failed_${response.status}`);
    },
    onmessage(event: OutfitEventSourceMessage) {
      const payload = parseEventPayload(event.data);
      if (event.event === "progress") {
        return;
      }

      if (event.event === "complete") {
        if (payload.ok !== true || !payload.report) {
          throw new FatalError("invalid_event_payload");
        }
        completePayload = {
          ok: true,
          report: payload.report as OutfitReport,
        };
        return;
      }

      if (event.event === "fatal") {
        throw new FatalError(String(payload.error || "service_unavailable"));
      }
    },
    onclose() {
      if (!completePayload) {
        throw new FatalError("event_stream_closed");
      }
    },
    onerror(error: Error) {
      throw error;
    },
  });

  if (!completePayload) {
    throw new FatalError("event_stream_closed");
  }

  return completePayload;
}

async function deleteOutfitReport(id: string): Promise<OutfitResponse> {
  return requestJson(outfitUrl(`${outfitIdPath(id)}/report`), {
    method: "DELETE",
    credentials: "include",
  });
}

async function downloadOutfitPdf(id: string): Promise<void> {
  const response = await request(outfitUrl(`${outfitIdPath(id)}/pdf`), {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    let message = `request_failed_${response.status}`;
    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch {
      // ignore
    }
    const error = new Error(message) as RequestErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const filename = getDownloadFilenameFromDisposition(
    response.headers.get("content-disposition"),
  );
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export {
  createOutfit,
  deleteOutfit,
  deleteOutfitImage,
  deleteOutfitReport,
  downloadOutfitPdf,
  duplicateOutfit,
  fetchOutfit,
  fetchOutfitBootstrap,
  fetchRecentOutfits,
  generateOutfitImage,
  generateOutfitReport,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  subscribeOutfitEvents,
  updateOutfitItems,
};
