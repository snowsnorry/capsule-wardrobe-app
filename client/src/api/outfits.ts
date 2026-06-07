import { API_BASE_URL } from "./config";
import { request, requestJson } from "./request";
import type { JsonObject } from "./request";

type OutfitResponse = JsonObject;
type OutfitListOptions = {
  limit?: number;
  offset?: number;
};
type OutfitItemSnapshot = Record<string, unknown>;
type RequestErrorWithStatus = Error & {
  status: number;
};

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

function toOutfitItemRef(item: OutfitItemSnapshot) {
  const url = String(item?.url || "").trim();
  const source = item?.source;
  return url && (source === "uploaded" || source === "from_catalog")
    ? { url, source }
    : null;
}

function toOutfitItemRefs(items: OutfitItemSnapshot[] = []) {
  return items
    .map(toOutfitItemRef)
    .filter((item): item is { url: string; source: string } => Boolean(item));
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

async function createOutfit({
  name,
  items = [],
}: {
  name?: string;
  items?: OutfitItemSnapshot[];
} = {}): Promise<OutfitResponse> {
  return requestJson(outfitUrl(""), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(typeof name === "string" && name.trim() ? { name } : {}),
      items: toOutfitItemRefs(items),
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
  downloadOutfitPdf,
  duplicateOutfit,
  fetchOutfit,
  fetchOutfitBootstrap,
  fetchRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  updateOutfitItems,
};
