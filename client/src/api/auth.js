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

async function fetchFormalityLevels() {
  return requestJson(`${API_BASE_URL}/profile/formality-levels`, {
    credentials: "include"
  });
}

async function fetchStyles() {
  return requestJson(`${API_BASE_URL}/profile/styles`, {
    credentials: "include"
  });
}

async function fetchOccasions() {
  return requestJson(`${API_BASE_URL}/profile/occasions`, {
    credentials: "include"
  });
}

async function fetchSeasons() {
  return requestJson(`${API_BASE_URL}/profile/seasons`, {
    credentials: "include"
  });
}

async function fetchAudience() {
  return requestJson(`${API_BASE_URL}/profile/audience`, {
    credentials: "include"
  });
}

async function fetchPatternOptions() {
  return requestJson(`${API_BASE_URL}/profile/patterns`, {
    credentials: "include"
  });
}

async function initializeProfile(
  formalityLevel,
  style,
  occasions,
  season,
  audience,
  locale
) {
  return requestJson(`${API_BASE_URL}/profile/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      formalityLevel,
      style,
      occasions,
      season,
      audience,
      locale
    })
  });
}

async function updateProfile(
  formalityLevel,
  style,
  occasions,
  season,
  audience,
  color,
  pattern,
  locale
) {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      formalityLevel,
      style,
      occasions,
      season,
      audience,
      color,
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
  fetchFormalityLevels,
  fetchStyles,
  fetchOccasions,
  fetchSeasons,
  fetchAudience,
  fetchPatternOptions,
  initializeProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  clearRequestCache,
  logout
};
