import { API_BASE_URL } from "./config.js";
import { request, requestJson } from "./request";
import type { JsonObject } from "./request";

type CapsuleResponse = JsonObject;
type CapsuleFilters = Record<string, unknown>;
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

function capsuleUrl(path = ""): string {
  return `${API_BASE_URL}/capsules${path}`;
}

function getDownloadFilenameFromDisposition(contentDisposition?: string | null): string {
  const header = String(contentDisposition || "");
  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // ignore malformed filename*
    }
  }

  const filenameMatch = header.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return (filenameMatch?.[1] || filenameMatch?.[2] || "").trim() || "capsule-wardrobe.pdf";
}

async function fetchCapsuleBootstrap(): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl("/bootstrap"), {
    credentials: "include"
  });
}

async function fetchRecentCapsules(): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl("/recent"), {
    credentials: "include"
  });
}

async function searchCapsules(query: string): Promise<CapsuleResponse> {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  const url = encodedQuery ? `${capsuleUrl("/search")}?q=${encodedQuery}` : capsuleUrl("/search");
  return requestJson(url, {
    credentials: "include"
  });
}

async function fetchCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}`), {
    credentials: "include"
  });
}

async function createCapsule(payload: CapsuleCreatePayload = {}): Promise<CapsuleResponse> {
  const body: CapsuleCreatePayload = {};
  if (typeof payload?.name === "string" && payload.name.trim()) {
    body.name = payload.name;
  }
  if (payload && typeof payload.filters === "object" && !Array.isArray(payload.filters) && payload.filters !== null) {
    body.filters = payload.filters;
  }

  return requestJson(capsuleUrl(""), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function updateCapsuleFilters(
  id: string,
  filters: CapsuleFilters,
  options: CapsuleFiltersOptions = {}
): Promise<CapsuleResponse> {
  return requestJson(buildCapsuleFiltersUrl(id, options), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters })
  });
}

function buildCapsuleFiltersUrl(id: string, { regenerate = false }: CapsuleFiltersOptions = {}): string {
  const params = new URLSearchParams();
  if (regenerate) {
    params.set("regenerate", "true");
  }

  const query = params.toString();
  return capsuleUrl(`/${id}/filters${query ? `?${query}` : ""}`);
}

async function updateCapsuleRejectedUrls(id: string, rejectedUrls: string[]): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}/rejected-urls`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejectedUrls })
  });
}

async function saveCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}/save`), {
    method: "POST",
    credentials: "include"
  });
}

async function revertCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}/revert`), {
    method: "POST",
    credentials: "include"
  });
}

async function renameCapsule(id: string, name: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}/rename`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
}

async function duplicateCapsule(id: string, name?: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}/duplicate`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {})
  });
}

async function selectCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}/select`), {
    method: "POST",
    credentials: "include"
  });
}

async function deleteCapsule(id: string): Promise<CapsuleResponse> {
  return requestJson(capsuleUrl(`/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
}

async function downloadCapsulePdf(id: string): Promise<void> {
  const response = await request(capsuleUrl(`/${id}/pdf`), {
    method: "POST",
    credentials: "include"
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

  const filename = getDownloadFilenameFromDisposition(response.headers.get("content-disposition"));
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
  downloadCapsulePdf,
  duplicateCapsule,
  fetchCapsule,
  fetchCapsuleBootstrap,
  fetchRecentCapsules,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  selectCapsule,
  updateCapsuleFilters,
  updateCapsuleRejectedUrls
};
