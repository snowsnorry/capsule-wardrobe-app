import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_COOKIE, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("profile status maps auth store failures", async (t) => {
  t.mock.method(console, "error", () => {});

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
  assert.equal(authFailure.response.status, 503);
  assert.deepEqual(authFailure.json, { error: "service_unavailable" });
});

test("profile read routes expose status, profile, and wardrobe filters", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const status = await requestJson(baseUrl, "/profile/status", {
    cookie: AUTH_COOKIE
  });
  assert.equal(status.response.status, 200);
  assert.deepEqual(status.json, { ok: true, hasProfile: true });

  const profile = await requestJson(baseUrl, "/profile/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.json.ok, true);
  assert.equal(profile.json.profile.email, "person@example.com");
  assert.equal(profile.json.profile.activeCapsuleId, "capsule-1");
  assert.equal(profile.json.profile.locale, "en");
  assert.equal(profile.json.profile.theme, "system");
  assert.equal(profile.json.profile.llm, "openai:gpt-5.5");
  assert.equal(profile.json.profile.image_llm, "openai:gpt-image-2");
  assert.equal(profile.json.profile.fullname, null);

  const wardrobeFilters = await requestJson(baseUrl, "/wardrobe/filters", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(wardrobeFilters.json, {
    ok: true,
    formalityLevels: ["casual", "formal"],
    styles: ["minimalistic", "sporty"],
    occasions: ["office", "date_night"],
    seasons: ["spring", "summer"],
    audience: ["man", "woman", "any"],
    patterns: ["striped", "plain"]
  });
});
