import { API_BASE_URL } from "./config.js";

async function requestLoginCode(email) {
  const response = await fetch(`${API_BASE_URL}/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "request_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function verifyLoginCode(email, code) {
  const response = await fetch(`${API_BASE_URL}/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, code })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "verify_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "unauthorized");
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchProfileStatus() {
  const response = await fetch(`${API_BASE_URL}/profile/status`, {
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "status_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchProfile() {
  const response = await fetch(`${API_BASE_URL}/profile/me`, {
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "profile_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchStylePreferences() {
  const response = await fetch(`${API_BASE_URL}/profile/style-preferences`, {
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "preferences_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchWardrobeOccasions() {
  const response = await fetch(`${API_BASE_URL}/profile/wardrobe-occasions`, {
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "occasions_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function initializeProfile(stylePreferences, wardrobeOccasions) {
  const response = await fetch(`${API_BASE_URL}/profile/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ stylePreferences, wardrobeOccasions })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "initialize_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function updateProfile(stylePreferences, wardrobeOccasions) {
  const response = await fetch(`${API_BASE_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ stylePreferences, wardrobeOccasions })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "update_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function deleteProfile() {
  const response = await fetch(`${API_BASE_URL}/profile/me`, {
    method: "DELETE",
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "delete_failed");
    error.data = data;
    throw error;
  }
  return data;
}

async function logout() {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "logout_failed");
    error.data = data;
    throw error;
  }
  return data;
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
  deleteProfile,
  logout
};
