import { API_BASE_URL } from "./config.js";
import { clearRequestCache, getCachedJson, requestJson } from "./request.js";

async function requestLoginCode(email) {
  return requestJson(`${API_BASE_URL}/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email })
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

async function fetchStylePreferences() {
  return requestJson(`${API_BASE_URL}/profile/style-preferences`, {
    credentials: "include"
  });
}

async function fetchWardrobeOccasions() {
  return requestJson(`${API_BASE_URL}/profile/wardrobe-occasions`, {
    credentials: "include"
  });
}

async function initializeProfile(stylePreferences, wardrobeOccasions, locale) {
  return requestJson(`${API_BASE_URL}/profile/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ stylePreferences, wardrobeOccasions, locale })
  });
}

async function updateProfile(stylePreferences, wardrobeOccasions, locale) {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ stylePreferences, wardrobeOccasions, locale })
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
  fetchCurrentUser,
  fetchProfileStatus,
  fetchProfile,
  fetchStylePreferences,
  fetchWardrobeOccasions,
  initializeProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  clearRequestCache,
  logout
};
