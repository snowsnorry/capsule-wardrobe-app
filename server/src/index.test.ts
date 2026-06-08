import { test, expect } from "vitest";
import { handleStartServerError, shouldStartServer } from "./index.js";
import {
  AUTH_COOKIE,
  TEST_CLIENT_ORIGIN,
  requestJson,
  requestText,
  startSpaFallbackTestServer,
  startTestServer,
} from "./test/serverRouteTestUtils.js";

test("index boot policy skips test and e2e server modes", () => {
  expect(shouldStartServer({ NODE_ENV: "test" })).toBe(false);
  expect(
    shouldStartServer({ NODE_ENV: "production", E2E_SERVER: "true" }),
  ).toBe(false);
  expect(shouldStartServer({ NODE_ENV: "production" })).toBe(true);
});

test("index boot error handler marks startup as failed", () => {
  const previousExitCode = process.exitCode;

  handleStartServerError(new Error("startup failed"));

  expect(process.exitCode).toBe(1);
  process.exitCode = previousExitCode;
});

test("index app wires representative registered routes", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const health = await requestJson(baseUrl, "/health");
  expect(health.response.status).toBe(200);
  expect(health.json).toEqual({ ok: true });

  const authorized = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE,
  });
  expect(authorized.response.status).toBe(200);
  expect(authorized.json).toEqual({
    ok: true,
    user: { email: "person@example.com" },
  });
});

test("index app exposes client api-prefixed routes before spa fallback", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t);

  const searchOptions = await requestJson(baseUrl, "/api/search/options", {
    cookie: AUTH_COOKIE,
  });

  expect(searchOptions.response.status).toBe(200);
  expect(searchOptions.json.ok).toBe(true);
  expect(searchOptions.json.audience).toEqual(["woman", "man", "all"]);
});

test("image cache path is no longer treated as an api path by spa fallback", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t);

  const { response, text } = await requestText(baseUrl, "/images/missing.jpg");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type") || "").toMatch(/text\/html/);
  expect(text).toContain("<title>Capsule Wardrobe</title>");
});

test("share fallback injects escaped open graph metadata into capsule html", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t, {
    overrides: {
      getSharedCapsuleOgMetadataImpl: async (id) =>
        id === "share-1"
          ? {
              title: 'Spring "Edit" & <Capsule>',
              description:
                "Formality: Casual. Style: Minimalistic. Occasions: Office, Date night.",
              image: 'https://images.example.com/outfit.jpg?fit="cover"&w=1200',
            }
          : null,
    },
  });

  const { response, text } = await requestText(baseUrl, "/share/share-1");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type") || "").toMatch(/text\/html/);
  expect(text).toMatch(
    /<meta property="og:title" content="Spring &quot;Edit&quot; &amp; &lt;Capsule&gt;" \/>/,
  );
  expect(text).toMatch(
    /<meta property="og:description" content="Formality: Casual\. Style: Minimalistic\. Occasions: Office, Date night\." \/>/,
  );
  expect(text).toMatch(
    /<meta property="og:image" content="https:\/\/images\.example\.com\/outfit\.jpg\?fit=&quot;cover&quot;&amp;w=1200" \/>/,
  );
  expect(text).toMatch(
    new RegExp(
      `<meta property="og:url" content="${TEST_CLIENT_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/share\\/share-1" \\/>`,
    ),
  );
  expect(text).toMatch(/<meta property="og:type" content="website" \/>/);
  expect(text.includes("Additional notes")).toBe(false);
});

test("share fallback leaves capsule html unchanged when shared capsule metadata is unavailable", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t, {
    overrides: {
      getSharedCapsuleOgMetadataImpl: async () => null,
    },
  });

  const { response, text } = await requestText(baseUrl, "/share/missing-share");

  expect(response.status).toBe(200);
  expect(text).toMatch(/<title>Capsule Wardrobe<\/title>/);
  expect(text.includes('property="og:title"')).toBe(false);
  expect(text.includes('property="og:description"')).toBe(false);
  expect(text.includes('property="og:image"')).toBe(false);
  expect(text.includes('property="og:url"')).toBe(false);
});
