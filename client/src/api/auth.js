import { API_BASE_URL } from "./config.js";
import { clearRequestCache, getCachedJson, requestJson } from "./request";

async function requestLoginCode(email, locale) {
  return requestJson(`${API_BASE_URL}/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, locale })
  });
}

async function verifyLoginCode(email, code) {
  return requestJson(`${API_BASE_URL}/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, code })
  });
}

async function signInWithGoogle(idToken) {
  return requestJson(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken })
  });
}

async function fetchProfileStatus() {
  return getCachedJson(`${API_BASE_URL}/profile/status`, {
    credentials: "include",
    ttlMs: 1000
  });
}

async function fetchProfile() {
  return getCachedJson(`${API_BASE_URL}/profile/me`, {
    credentials: "include",
    ttlMs: 1000
  });
}

async function fetchCurrentUser() {
  return getCachedJson(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
    ttlMs: 1000
  });
}

async function fetchWardrobeFilters() {
  return requestJson(`${API_BASE_URL}/wardrobe/filters`, {
    credentials: "include"
  });
}

async function initializeProfile(locale) {
  return requestJson(`${API_BASE_URL}/profile/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale })
  });
}

async function updateProfile(profile) {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(profile)
  });
}

async function updateProfileLocale(locale) {
  return requestJson(`${API_BASE_URL}/profile/locale`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale })
  });
}

async function deleteProfile() {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "DELETE",
    credentials: "include"
  });
}

async function logout() {
  return requestJson(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
}

export {
  requestLoginCode,
  verifyLoginCode,
  signInWithGoogle,
  fetchCurrentUser,
  fetchProfileStatus,
  fetchProfile,
  fetchWardrobeFilters,
  initializeProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  clearRequestCache,
  logout
};
