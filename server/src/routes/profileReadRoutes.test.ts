import { test, expect, vi } from "vitest";
import { AUTH_COOKIE, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("profile status maps auth store failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const failingAuthServer = await startTestServer(t, {
    overrides: {
      getSessionImpl: async () => {
        throw new Error("session_store_down");
      }
    }
  });
  const authFailure = await requestJson(failingAuthServer.baseUrl, "/profile/status", {
    cookie: AUTH_COOKIE
  });
  expect(authFailure.response.status).toBe(503);
  expect(authFailure.json).toEqual({ error: "service_unavailable" });
});

test("profile read routes expose status, profile, and wardrobe filters", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const status = await requestJson(baseUrl, "/profile/status", {
    cookie: AUTH_COOKIE
  });
  expect(status.response.status).toBe(200);
  expect(status.json).toEqual({ ok: true, hasProfile: true });

  const profile = await requestJson(baseUrl, "/profile/me", {
    cookie: AUTH_COOKIE
  });
  expect(profile.response.status).toBe(200);
  expect(profile.json.ok).toBe(true);
  expect(profile.json.profile.email).toBe("person@example.com");
  expect(profile.json.profile.activeCapsuleId).toBe("capsule-1");
  expect(profile.json.profile.locale).toBe("en");
  expect(profile.json.profile.theme).toBe("system");
  expect(profile.json.profile.llm).toBe("openai:gpt-5.5");
  expect(profile.json.profile.image_llm).toBe("openai:gpt-image-2");
  expect(profile.json.profile.fullname).toBe(null);

  const wardrobeFilters = await requestJson(baseUrl, "/wardrobe/filters", {
    cookie: AUTH_COOKIE
  });
  expect(wardrobeFilters.json).toEqual({
    ok: true,
    formalityLevels: ["casual", "formal"],
    styles: ["minimalistic", "sporty"],
    occasions: ["office", "date_night"],
    seasons: ["spring", "summer"],
    audience: ["man", "woman", "any"],
    patterns: ["striped", "plain"]
  });
});

test("profile read routes map missing profile and store failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const missingProfileServer = await startTestServer(t, {
    overrides: {
      getProfileImpl: async () => null
    }
  });
  const missingProfile = await requestJson(missingProfileServer.baseUrl, "/profile/me", {
    cookie: AUTH_COOKIE
  });
  expect(missingProfile.response.status).toBe(404);
  expect(missingProfile.json).toEqual({ error: "not_found" });

  const failingProfileServer = await startTestServer(t, {
    overrides: {
      getProfileImpl: async () => {
        throw new Error("profile_store_down");
      }
    }
  });
  const profileFailure = await requestJson(failingProfileServer.baseUrl, "/profile/me", {
    cookie: AUTH_COOKIE
  });
  expect(profileFailure.response.status).toBe(503);
  expect(profileFailure.json).toEqual({ error: "service_unavailable" });

  const failingFiltersServer = await startTestServer(t, {
    overrides: {
      getSeasonsImpl: async () => {
        throw new Error("options_store_down");
      }
    }
  });
  const filtersFailure = await requestJson(failingFiltersServer.baseUrl, "/wardrobe/filters", {
    cookie: AUTH_COOKIE
  });
  expect(filtersFailure.response.status).toBe(503);
  expect(filtersFailure.json).toEqual({ error: "service_unavailable" });
});
