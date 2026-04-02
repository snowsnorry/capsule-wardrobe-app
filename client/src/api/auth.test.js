import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  clearRequestCache: vi.fn(),
  getCachedJson: vi.fn(),
  requestJson: vi.fn()
}));

vi.mock("./request.js", () => requestApi);
vi.mock("./config.js", () => ({
  API_BASE_URL: "https://api.example.test"
}));

import {
  requestLoginCode,
  verifyLoginCode,
  signInWithGoogle,
  fetchProfileStatus,
  fetchProfile,
  fetchCurrentUser,
  fetchWardrobeFilters,
  initializeProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  logout
} from "./auth.js";

describe("auth api", () => {
  beforeEach(() => {
    requestApi.clearRequestCache.mockReset();
    requestApi.getCachedJson.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({});
    requestApi.getCachedJson.mockResolvedValue({});
  });

  test("requestLoginCode posts email and locale payload", async () => {
    await requestLoginCode("person@example.com", "ru");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/auth/request-code",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: "person@example.com", locale: "ru" })
      }
    );
  });

  test("verifyLoginCode and google auth post expected request contracts", async () => {
    await verifyLoginCode("person@example.com", "654321");
    await signInWithGoogle("google-token");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/auth/verify-code",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: "person@example.com", code: "654321" })
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/auth/google",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken: "google-token" })
      }
    );
  });

  test("cached auth/profile reads use include credentials and expected ttl", async () => {
    await fetchProfileStatus();
    await fetchProfile();
    await fetchCurrentUser();

    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/profile/status",
      { credentials: "include", ttlMs: 1000 }
    );
    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/profile/me",
      { credentials: "include", ttlMs: 1000 }
    );
    expect(requestApi.getCachedJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/auth/me",
      { credentials: "include", ttlMs: 1000 }
    );
  });

  test("wardrobe filter options are loaded with a single authenticated request", async () => {
    await fetchWardrobeFilters();

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/filters",
      { credentials: "include" }
    );
  });

  test("profile mutation helpers shape initialize, update, and locale payloads", async () => {
    await initializeProfile("en");
    await updateProfile({
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.2",
      fullname: "Ada Lovelace"
    });
    await updateProfileLocale("ru");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/profile/initialize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale: "en" })
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/profile/me",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          locale: "ru",
          theme: "dark",
          llm: "openai:gpt-5.2",
          fullname: "Ada Lovelace"
        })
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/profile/locale",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale: "ru" })
      }
    );
  });

  test("deleteProfile and logout use destructive request contracts", async () => {
    await deleteProfile();
    await logout();

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/profile/me",
      {
        method: "DELETE",
        credentials: "include"
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/auth/logout",
      {
        method: "POST",
        credentials: "include"
      }
    );
  });
});
