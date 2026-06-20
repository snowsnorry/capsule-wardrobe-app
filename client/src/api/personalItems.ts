import { API_BASE_URL } from "./config";
import { getCachedJson, getCsrfHeader, request, requestJson } from "./request";
import type { JsonObject } from "./request";
import type { PersonalItemsReport } from "../app/appTypes";

type PersonalItemSource = "uploaded" | "from_catalog";
type UploadWardrobeProgress = {
  completedSteps: number;
  failed: number;
  imageProcessed: number;
  metadataProcessed: number;
  total: number;
  uploaded: number;
};
type UploadWardrobeImagesOptions = {
  onProgress?: (progress: UploadWardrobeProgress) => void;
};
type PersonalItemsFetchOptions = {
  force?: boolean;
  source?: PersonalItemSource | null;
};
type UploadedWardrobeItemUpdatePayload = {
  name: string;
  description: string | null;
  brand: string | null;
  audience: string;
  category: string;
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  colorBase: string[];
  pattern: string | null;
  finish: string | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closureType: string[];
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
type PersonalItemsReportResponse = {
  generatedAt?: string | null;
  ok: true;
  personalItemUrls?: string[];
  report: PersonalItemsReport | null;
  stale?: boolean;
};
type GeneratePersonalItemsReportResponse = {
  generatedAt?: string | null;
  ok: true;
  personalItemUrls?: string[];
  report: PersonalItemsReport;
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

function getWardrobeItemsUrl({
  source = null,
}: PersonalItemsFetchOptions = {}) {
  const params = new URLSearchParams();
  if (source) {
    params.set("source", source);
  }
  const query = params.toString();
  return `${API_BASE_URL}/wardrobe/items${query ? `?${query}` : ""}`;
}

function getWardrobeItemsPdfUrl(options: PersonalItemsFetchOptions = {}) {
  const params = new URLSearchParams();
  if (options.source) {
    params.set("source", options.source);
  }
  const query = params.toString();
  return `${API_BASE_URL}/wardrobe/items/pdf${query ? `?${query}` : ""}`;
}

function getPersonalItemsReportUrl() {
  return `${API_BASE_URL}/wardrobe/items/report`;
}

function parseUploadEventPayload(data: string | undefined): JsonObject {
  if (typeof data !== "string" || data.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    throw new Error("invalid_event_payload");
  }
}

function toUploadProgress(payload: JsonObject): UploadWardrobeProgress {
  return {
    total: Number(payload.total) || 0,
    uploaded: Number(payload.uploaded) || 0,
    completedSteps: Number(payload.completedSteps) || 0,
    metadataProcessed: Number(payload.metadataProcessed) || 0,
    imageProcessed: Number(payload.imageProcessed) || 0,
    failed: Number(payload.failed) || 0,
  };
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
    "personal-items.pdf"
  );
}

async function fetchPersonalItems(
  options: PersonalItemsFetchOptions = {},
): Promise<JsonObject> {
  return getCachedJson(getWardrobeItemsUrl(options), {
    credentials: "include",
    force: options.force,
  });
}

async function fetchPersonalItemsReport(
  options: {
    force?: boolean;
  } = {},
): Promise<PersonalItemsReportResponse> {
  const response = await getCachedJson(getPersonalItemsReportUrl(), {
    credentials: "include",
    force: options.force,
  });

  return response as PersonalItemsReportResponse;
}

async function generatePersonalItemsReport(): Promise<GeneratePersonalItemsReportResponse> {
  const fetchEventSource = await loadFetchEventSource();
  let completePayload: GeneratePersonalItemsReportResponse | null = null;

  await fetchEventSource(getPersonalItemsReportUrl(), {
    method: "POST",
    credentials: "include",
    headers: getCsrfHeader(),
    openWhenHidden: true,
    async onopen(
      response: Pick<Response, "ok" | "status"> & {
        headers: Pick<Headers, "get">;
      },
    ) {
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (response.ok && contentType.includes("text/event-stream")) {
        return;
      }

      throw new Error(`request_failed_${response.status}`);
    },
    onmessage(event: { data?: string; event?: string }) {
      const payload = parseUploadEventPayload(event.data);
      if (event.event === "progress") {
        return;
      }

      if (event.event === "complete") {
        if (payload.ok !== true || !payload.report) {
          throw new Error("invalid_event_payload");
        }
        completePayload = {
          generatedAt:
            typeof payload.generatedAt === "string"
              ? payload.generatedAt
              : null,
          ok: true,
          personalItemUrls: Array.isArray(payload.personalItemUrls)
            ? payload.personalItemUrls.map((value) => String(value))
            : [],
          report: payload.report as PersonalItemsReport,
        };
        return;
      }

      if (event.event === "fatal") {
        throw new Error(String(payload.error || "service_unavailable"));
      }
    },
    onclose() {
      if (!completePayload) {
        throw new Error("event_stream_closed");
      }
    },
    onerror(error: Error) {
      throw error;
    },
  });

  if (!completePayload) {
    throw new Error("event_stream_closed");
  }

  return completePayload;
}

async function fetchUploadedWardrobeItemDetail(
  id: string | number,
): Promise<JsonObject> {
  return getCachedJson(
    `${API_BASE_URL}/wardrobe/items/uploaded/${encodeURIComponent(String(id))}`,
    {
      credentials: "include",
      ttlMs: 60_000,
    },
  );
}

async function uploadWardrobeImages(
  files: File[],
  options: UploadWardrobeImagesOptions = {},
): Promise<JsonObject> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  return uploadWardrobeEventStream(
    `${API_BASE_URL}/wardrobe/items/upload`,
    {
      body: formData,
      headers: getCsrfHeader(),
    },
    options,
  );
}

async function uploadWardrobeUrls(
  urls: string[],
  options: UploadWardrobeImagesOptions = {},
): Promise<JsonObject> {
  return uploadWardrobeEventStream(
    `${API_BASE_URL}/wardrobe/items/upload-url`,
    {
      body: JSON.stringify({ urls }),
      headers: {
        ...getCsrfHeader(),
        "Content-Type": "application/json",
      },
    },
    options,
  );
}

async function uploadWardrobeEventStream(
  url: string,
  requestOptions: { body: BodyInit; headers: Record<string, string> },
  options: UploadWardrobeImagesOptions = {},
): Promise<JsonObject> {
  const fetchEventSource = await loadFetchEventSource();
  let completePayload: JsonObject | null = null;
  await fetchEventSource(url, {
    method: "POST",
    credentials: "include",
    headers: requestOptions.headers,
    body: requestOptions.body,
    openWhenHidden: true,
    async onopen(response) {
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (response.ok && contentType.includes("text/event-stream")) {
        return;
      }

      throw new Error(`request_failed_${response.status}`);
    },
    onmessage(event) {
      const payload = parseUploadEventPayload(event.data);
      if (event.event === "progress") {
        options.onProgress?.(toUploadProgress(payload));
        return;
      }

      if (event.event === "complete") {
        options.onProgress?.(toUploadProgress(payload));
        completePayload = payload;
        return;
      }

      if (event.event === "fatal") {
        throw new Error(String(payload.error || "service_unavailable"));
      }
    },
    onclose() {
      if (!completePayload) {
        throw new Error("event_stream_closed");
      }
    },
    onerror(error) {
      throw error;
    },
  });

  return completePayload || {};
}

async function saveCatalogItemToPersonalItems(
  url: string,
): Promise<JsonObject> {
  return requestJson(`${API_BASE_URL}/wardrobe/items/from-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
}

async function removeCatalogItemFromPersonalItems(
  url: string,
): Promise<JsonObject> {
  return requestJson(`${API_BASE_URL}/wardrobe/items/from-catalog`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
}

async function updateUploadedWardrobeItem(
  id: string | number,
  payload: UploadedWardrobeItemUpdatePayload,
): Promise<JsonObject> {
  return requestJson(
    `${API_BASE_URL}/wardrobe/items/uploaded/${encodeURIComponent(String(id))}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    },
  );
}

async function deleteUploadedWardrobeItem(
  id: string | number,
): Promise<JsonObject> {
  return requestJson(
    `${API_BASE_URL}/wardrobe/items/uploaded/${encodeURIComponent(String(id))}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
}

async function deletePersonalItemsReport(): Promise<JsonObject> {
  return requestJson(getPersonalItemsReportUrl(), {
    method: "DELETE",
    credentials: "include",
  });
}

async function downloadPersonalItemsPdf(
  options: PersonalItemsFetchOptions = {},
): Promise<void> {
  const response = await request(getWardrobeItemsPdfUrl(options), {
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
  deletePersonalItemsReport,
  deleteUploadedWardrobeItem,
  downloadPersonalItemsPdf,
  fetchPersonalItems,
  fetchPersonalItemsReport,
  fetchUploadedWardrobeItemDetail,
  generatePersonalItemsReport,
  getPersonalItemsReportUrl,
  getWardrobeItemsPdfUrl,
  getWardrobeItemsUrl,
  removeCatalogItemFromPersonalItems,
  saveCatalogItemToPersonalItems,
  updateUploadedWardrobeItem,
  uploadWardrobeImages,
  uploadWardrobeUrls,
};
export type { PersonalItemSource };
export type { PersonalItemsReportResponse };
export type { UploadedWardrobeItemUpdatePayload };
export type { UploadWardrobeProgress };
