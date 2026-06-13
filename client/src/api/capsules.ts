/* eslint-disable max-lines */
import { API_BASE_URL } from "./config";
import { getCsrfHeader, request, requestJson } from "./request";
import type { JsonObject } from "./request";
import type { CapsuleReport } from "../app/appTypes";

type CapsuleResponse = JsonObject;
type CapsuleReportResponse = {
  ok: true;
  report: CapsuleReport;
};
type CapsuleFilters = Record<string, unknown>;
type CapsuleListOptions = {
  limit?: number;
  offset?: number;
};
type CapsuleCreatePayload = Record<string, unknown> & {
  filters?: CapsuleFilters | null;
  name?: string;
};
type CapsuleFiltersOptions = {
  regenerate?: boolean;
};
type RequestErrorWithStatus = Error & {
  status: number;
};
type EventStreamLike = {
  fetchEventSource: (
    url: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};
type CapsuleEventSourceMessage = {
  data?: string;
  event?: string;
};
type CapsuleReportStreamResponse = Pick<Response, "ok" | "status"> & {
  headers: Pick<Headers, "get">;
};

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

function capsuleUrl(path = ""): string {
  return `${API_BASE_URL}/capsules${path}`;
}

function capsuleIdPath(id: string): string {
  return `/${encodeURIComponent(String(id || "").trim())}`;
}

function sharedCapsuleUrl(path = ""): string {
  return `${API_BASE_URL}/shared-capsules${path}`;
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

async function fetchCapsuleBootstrap(): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl("/bootstrap"), {
    credentials: "include",
  });
}

function buildCapsuleListQuery({ limit, offset }: CapsuleListOptions = {}) {
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

async function fetchRecentCapsules(
  options: CapsuleListOptions = {},
): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/recent${buildCapsuleListQuery(options)}`), {
    credentials: "include",
  });
}

async function searchCapsules(query: string): Promise<CapsuleResponse> {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  const url = encodedQuery
    ? `${capsuleUrl("/search")}?q=${encodedQuery}`
    : capsuleUrl("/search");
  return requestJson(url, {
    credentials: "include",
  });
}

async function fetchCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(capsuleIdPath(id)), {
    credentials: "include",
  });
}

async function createCapsule(
  payload: CapsuleCreatePayload = {},
): Promise<CapsuleResponse> {
  const body: CapsuleCreatePayload = {};
  if (typeof payload?.name === "string" && payload.name.trim()) {
    body.name = payload.name;
  }
  if (
    payload &&
    typeof payload.filters === "object" &&
    !Array.isArray(payload.filters) &&
    payload.filters !== null
  ) {
    body.filters = payload.filters;
  }

  return requestJson(capsuleUrl(""), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function updateCapsuleFilters(
  id: string,
  filters: CapsuleFilters,
  options: CapsuleFiltersOptions = {},
): Promise<CapsuleResponse> {
  return requestJson(buildCapsuleFiltersUrl(id, options), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
  });
}

function buildCapsuleFiltersUrl(
  id: string,
  { regenerate = false }: CapsuleFiltersOptions = {},
): string {
  const params = new URLSearchParams();
  if (regenerate) {
    params.set("regenerate", "true");
  }

  const query = params.toString();
  return capsuleUrl(`${capsuleIdPath(id)}/filters${query ? `?${query}` : ""}`);
}

async function updateCapsuleRejectedUrls(
  id: string,
  rejectedUrls: string[],
): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/rejected-urls`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejectedUrls }),
  });
}

async function saveCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/save`), {
    method: "POST",
    credentials: "include",
  });
}

async function revertCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/revert`), {
    method: "POST",
    credentials: "include",
  });
}

async function renameCapsule(
  id: string,
  name: string,
): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/rename`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

async function duplicateCapsule(
  id: string,
  name?: string,
): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/duplicate`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
}

async function shareCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/share`), {
    method: "POST",
    credentials: "include",
  });
}

async function fetchSharedCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(sharedCapsuleUrl(`/${encodeURIComponent(id)}`), {
    credentials: "include",
  });
}

async function importSharedCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(sharedCapsuleUrl(`/${encodeURIComponent(id)}/import`), {
    method: "POST",
    credentials: "include",
  });
}

async function selectCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/select`), {
    method: "POST",
    credentials: "include",
  });
}

async function deleteCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(capsuleIdPath(id)), {
    method: "DELETE",
    credentials: "include",
  });
}

async function generateCapsuleReport(
  id: string,
): Promise<CapsuleReportResponse> {
  const fetchEventSource = await loadFetchEventSource();
  let completePayload: CapsuleReportResponse | null = null;

  await fetchEventSource(capsuleUrl(`${capsuleIdPath(id)}/report`), {
    method: "POST",
    credentials: "include",
    headers: getCsrfHeader(),
    openWhenHidden: true,
    async onopen(response: CapsuleReportStreamResponse) {
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (response.ok && contentType.includes("text/event-stream")) {
        return;
      }

      throw new FatalError(`request_failed_${response.status}`);
    },
    onmessage(event: CapsuleEventSourceMessage) {
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
          report: payload.report as CapsuleReport,
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

async function deleteCapsuleReport(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`${capsuleIdPath(id)}/report`), {
    method: "DELETE",
    credentials: "include",
  });
}

async function downloadCapsulePdf(id: string): Promise<void> {
  const response = await request(capsuleUrl(`${capsuleIdPath(id)}/pdf`), {
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
  createCapsule,
  deleteCapsule,
  deleteCapsuleReport,
  downloadCapsulePdf,
  duplicateCapsule,
  fetchCapsule,
  fetchCapsuleBootstrap,
  fetchRecentCapsules,
  generateCapsuleReport,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  fetchSharedCapsule,
  importSharedCapsule,
  selectCapsule,
  shareCapsule,
  updateCapsuleFilters,
  updateCapsuleRejectedUrls,
};
