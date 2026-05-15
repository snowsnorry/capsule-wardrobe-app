import { API_BASE_URL } from "./config";
import { getCachedJson, request, requestJson } from "./request";
import type { JsonObject } from "./request";
import { fetchEventSource } from "@microsoft/fetch-event-source";

type MyWardrobeSource = "uploaded" | "from_catalog";
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
type MyWardrobeFetchOptions = {
  force?: boolean;
  source?: MyWardrobeSource | null;
};
type UploadedWardrobeItemUpdatePayload = {
  name: string;
  description: string | null;
  brand: string | null;
  audience: string;
  category: string;
  season: string[];
  formality_level: string[];
  style: string[];
  occasions: string[];
  color_base: string[];
  pattern: string | null;
  finish: string | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closure_type: string[];
};
type RequestErrorWithStatus = Error & {
  status: number;
};

function getWardrobeItemsUrl({ source = null }: MyWardrobeFetchOptions = {}) {
  const params = new URLSearchParams();
  if (source) {
    params.set("source", source);
  }
  const query = params.toString();
  return `${API_BASE_URL}/wardrobe/items${query ? `?${query}` : ""}`;
}

function getWardrobeItemsPdfUrl(options: MyWardrobeFetchOptions = {}) {
  const params = new URLSearchParams();
  if (options.source) {
    params.set("source", options.source);
  }
  const query = params.toString();
  return `${API_BASE_URL}/wardrobe/items/pdf${query ? `?${query}` : ""}`;
}

function getCsrfHeader(): Record<string, string> {
  if (typeof document === "undefined") {
    return {};
  }

  let cookie: string;
  try {
    cookie = document.cookie;
  } catch {
    return {};
  }

  const csrfToken = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrf="))
    ?.slice("csrf=".length);
  return csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {};
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
    (filenameMatch?.[1] || filenameMatch?.[2] || "").trim() || "my-wardrobe.pdf"
  );
}

async function fetchMyWardrobeItems(
  options: MyWardrobeFetchOptions = {},
): Promise<JsonObject> {
  return getCachedJson(getWardrobeItemsUrl(options), {
    credentials: "include",
    force: options.force,
  });
}

async function uploadWardrobeImages(
  files: File[],
  options: UploadWardrobeImagesOptions = {},
): Promise<JsonObject> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  let completePayload: JsonObject | null = null;
  await fetchEventSource(`${API_BASE_URL}/wardrobe/items/upload`, {
    method: "POST",
    credentials: "include",
    headers: getCsrfHeader(),
    body: formData,
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

async function saveCatalogItemToMyWardrobe(url: string): Promise<JsonObject> {
  return requestJson(`${API_BASE_URL}/wardrobe/items/from-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
}

async function removeCatalogItemFromMyWardrobe(
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

async function downloadMyWardrobePdf(
  options: MyWardrobeFetchOptions = {},
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
  deleteUploadedWardrobeItem,
  downloadMyWardrobePdf,
  fetchMyWardrobeItems,
  getWardrobeItemsPdfUrl,
  getWardrobeItemsUrl,
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
  updateUploadedWardrobeItem,
  uploadWardrobeImages,
};
export type { MyWardrobeSource };
export type { UploadedWardrobeItemUpdatePayload };
export type { UploadWardrobeProgress };
