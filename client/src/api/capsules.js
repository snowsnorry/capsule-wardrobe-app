import { API_BASE_URL } from "./config.js";
import { request, requestJson } from "./request.js";

function capsuleUrl(path = "") {
  return `${API_BASE_URL}/capsules${path}`;
}

async function fetchCapsuleBootstrap() {
  return requestJson(capsuleUrl("/bootstrap"), {
    credentials: "include"
  });
}

async function fetchRecentCapsules() {
  return requestJson(capsuleUrl("/recent"), {
    credentials: "include"
  });
}

async function searchCapsules(query) {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  const url = encodedQuery ? `${capsuleUrl("/search")}?q=${encodedQuery}` : capsuleUrl("/search");
  return requestJson(url, {
    credentials: "include"
  });
}

async function fetchCapsule(id) {
  return requestJson(capsuleUrl(`/${id}`), {
    credentials: "include"
  });
}

async function createCapsule(payload = {}) {
  return requestJson(capsuleUrl(""), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function updateCapsuleDraft(id, draft) {
  return requestJson(capsuleUrl(`/${id}/draft`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft })
  });
}

async function saveCapsule(id) {
  return requestJson(capsuleUrl(`/${id}/save`), {
    method: "POST",
    credentials: "include"
  });
}

async function revertCapsule(id) {
  return requestJson(capsuleUrl(`/${id}/revert`), {
    method: "POST",
    credentials: "include"
  });
}

async function renameCapsule(id, name) {
  return requestJson(capsuleUrl(`/${id}/rename`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
}

async function duplicateCapsule(id, name) {
  return requestJson(capsuleUrl(`/${id}/duplicate`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {})
  });
}

async function selectCapsule(id) {
  return requestJson(capsuleUrl(`/${id}/select`), {
    method: "POST",
    credentials: "include"
  });
}

async function deleteCapsule(id) {
  return requestJson(capsuleUrl(`/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
}

async function downloadCapsulePdf(id) {
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
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "capsule-wardrobe.pdf";
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
  updateCapsuleDraft
};
