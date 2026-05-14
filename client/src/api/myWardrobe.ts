import { API_BASE_URL } from "./config";
import { getCachedJson, request, requestJson } from "./request";
import type { JsonObject } from "./request";

type MyWardrobeSource = "uploaded" | "from_catalog";
type MyWardrobeFetchOptions = {
  force?: boolean;
  source?: MyWardrobeSource | null;
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

async function uploadWardrobeImages(files: File[]): Promise<JsonObject> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  return requestJson(`${API_BASE_URL}/wardrobe/items/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
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
  downloadMyWardrobePdf,
  fetchMyWardrobeItems,
  getWardrobeItemsPdfUrl,
  getWardrobeItemsUrl,
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
  uploadWardrobeImages,
};
export type { MyWardrobeSource };
