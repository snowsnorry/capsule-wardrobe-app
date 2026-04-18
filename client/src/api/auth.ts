import { API_BASE_URL } from "./config.js";
import { clearRequestCache, getCachedJson, requestJson } from "./request";
import type { JsonObject } from "./request";

type AuthResponse = JsonObject;
type ProfileUpdatePayload = Record<string, unknown>;

async function requestLoginCode(email: string, locale: string): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, locale })
  });
}

async function verifyLoginCode(email: string, code: string): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, code })
  });
}

async function signInWithGoogle(idToken: string): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken })
  });
}

async function fetchProfileStatus(): Promise<AuthResponse> {
  return getCachedJson(`${API_BASE_URL}/profile/status`, {
    credentials: "include",
    ttlMs: 1000
  });
}

async function fetchProfile(): Promise<AuthResponse> {
  return getCachedJson(`${API_BASE_URL}/profile/me`, {
    credentials: "include",
    ttlMs: 1000
  });
}

async function fetchCurrentUser(): Promise<AuthResponse> {
  return getCachedJson(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
    ttlMs: 1000
  });
}

async function fetchWardrobeFilters(): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/wardrobe/filters`, {
    credentials: "include"
  });
}

async function initializeProfile(locale: string): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/profile/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale })
  });
}

async function updateProfile(profile: ProfileUpdatePayload): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(profile)
  });
}

async function updateProfileLocale(locale: string): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/profile/locale`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale })
  });
}

async function deleteProfile(): Promise<AuthResponse> {
  return requestJson(`${API_BASE_URL}/profile/me`, {
    method: "DELETE",
    credentials: "include"
  });
}

async function logout(): Promise<AuthResponse> {
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
