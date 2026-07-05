import { API_BASE_URL } from "./config";
import { getCachedJson, request, requestJson } from "./request";
import type { JsonObject } from "./request";
import { parseTrackedJobResponse, type JobResponse } from "./jobs";
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
const EMPTY_UPLOAD_PROGRESS: UploadWardrobeProgress = {
  completedSteps: 0,
  failed: 0,
  imageProcessed: 0,
  metadataProcessed: 0,
  total: 0,
  uploaded: 0,
};
type PersonalItemsFetchOptions = {
  cursor?: string | null;
  force?: boolean;
  likedOnly?: boolean;
  limit?: number | null;
  source?: PersonalItemSource | null;
};
type PersonalItemsPagination = {
  hasMore: boolean;
  limit: number;
  nextCursor: string | null;
};
type PersonalItemsResponse = JsonObject & {
  items?: unknown[];
  pagination?: PersonalItemsPagination;
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
type PersonalItemsReportResponse = {
  generatedAt?: string | null;
  ok: true;
  personalItemUrls?: string[];
  report: PersonalItemsReport | null;
  stale?: boolean;
};
function getWardrobeItemsUrl({
  cursor = null,
  likedOnly = false,
  limit = null,
  source = null,
}: PersonalItemsFetchOptions = {}) {
  const params = new URLSearchParams();
  if (source) {
    params.set("source", source);
  }
  if (likedOnly) {
    params.set("likedOnly", "true");
  }
  if (limit) {
    params.set("limit", String(limit));
  }
  if (cursor) {
    params.set("cursor", cursor);
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
): Promise<PersonalItemsResponse> {
  return getCachedJson(getWardrobeItemsUrl(options), {
    credentials: "include",
    force: options.force,
  }) as Promise<PersonalItemsResponse>;
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

async function generatePersonalItemsReport(): Promise<JobResponse> {
  return parseTrackedJobResponse(
    await requestJson(getPersonalItemsReportUrl(), {
      method: "POST",
      credentials: "include",
    }),
  );
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
): Promise<JobResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  options.onProgress?.({
    ...EMPTY_UPLOAD_PROGRESS,
    total: files.length,
  });
  return parseTrackedJobResponse(
    await requestJson(`${API_BASE_URL}/wardrobe/items/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }),
  );
}

async function uploadWardrobeUrls(
  urls: string[],
  options: UploadWardrobeImagesOptions = {},
): Promise<JobResponse> {
  options.onProgress?.({
    ...EMPTY_UPLOAD_PROGRESS,
    total: urls.length,
  });
  return parseTrackedJobResponse(
    await requestJson(`${API_BASE_URL}/wardrobe/items/upload-url`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls }),
    }),
  );
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
export type { PersonalItemsFetchOptions };
export type { PersonalItemsPagination };
export type { PersonalItemsReportResponse };
export type { PersonalItemsResponse };
export type { UploadedWardrobeItemUpdatePayload };
export type { UploadWardrobeProgress };
