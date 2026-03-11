import { API_BASE_URL } from "./config.js";
import { clearRequestCache, getCachedJson, requestJson } from "./request.js";

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

async function fetchWardrobeSeasons() {
  return requestJson(`${API_BASE_URL}/profile/wardrobe-seasons`, {
    credentials: "include"
  });
}

async function fetchWardrobeAudience() {
  return requestJson(`${API_BASE_URL}/profile/wardrobe-audience`, {
    credentials: "include"
  });
}

async function fetchPatternOptions() {
  return requestJson(`${API_BASE_URL}/profile/patterns`, {
    credentials: "include"
  });
}

async function initializeProfile(
  styleCore,
  styleAesthetic,
  wardrobeOccasions,
  wardrobeSeasons,
  wardrobeAudience,
  locale
) {
  return requestJson(`${API_BASE_URL}/profile/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      styleCore,
      styleAesthetic,
      wardrobeOccasions,
      wardrobeSeasons,
      wardrobeAudience,
      locale
    })
  });
}

async function updateProfile(
  styleCore,
  styleAesthetic,
  wardrobeOccasions,
  wardrobeSeasons,
  wardrobeAudience,
  accentColor,
  pattern,
  locale
) {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      styleCore,
      styleAesthetic,
      wardrobeOccasions,
      wardrobeSeasons,
      wardrobeAudience,
      accentColor,
      pattern,
      locale
    })
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
  fetchStylePreferences,
  fetchWardrobeOccasions,
  fetchWardrobeSeasons,
  fetchWardrobeAudience,
  fetchPatternOptions,
  initializeProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  clearRequestCache,
  logout
};
