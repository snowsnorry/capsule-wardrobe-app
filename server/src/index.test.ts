import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_COOKIE,
  requestJson,
  requestText,
  startSpaFallbackTestServer,
  startTestServer
} from "./test/serverRouteTestUtils.js";

test("index app wires representative registered routes", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const health = await requestJson(baseUrl, "/health");
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.json, { ok: true });

  const authorized = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(authorized.response.status, 200);
  assert.deepEqual(authorized.json, {
    ok: true,
    user: { email: "person@example.com" }
  });
});

test("image cache route is treated as an api path by spa fallback", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t);

  const missing = await requestJson(baseUrl, "/images/missing.jpg");
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.json, { error: "not_found" });
});

test("share fallback injects escaped open graph metadata into capsule html", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t, {
    overrides: {
      getSharedCapsuleOgMetadataImpl: async (id) => (
        id === "share-1"
          ? {
            title: "Spring \"Edit\" & <Capsule>",
            description: "Formality: Casual. Style: Minimalistic. Occasions: Office, Date night.",
            image: "https://images.example.com/outfit.jpg?fit=\"cover\"&w=1200"
          }
          : null
      )
    }
  });

  const { response, text } = await requestText(baseUrl, "/share/share-1");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /<meta property="og:title" content="Spring &quot;Edit&quot; &amp; &lt;Capsule&gt;" \/>/);
  assert.match(text, /<meta property="og:description" content="Formality: Casual\. Style: Minimalistic\. Occasions: Office, Date night\." \/>/);
  assert.match(text, /<meta property="og:image" content="https:\/\/images\.example\.com\/outfit\.jpg\?fit=&quot;cover&quot;&amp;w=1200" \/>/);
  assert.match(text, new RegExp(`<meta property="og:url" content="${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/share\\/share-1" \\/>`));
  assert.match(text, /<meta property="og:type" content="website" \/>/);
  assert.equal(text.includes("Additional notes"), false);
});

test("share fallback leaves capsule html unchanged when shared capsule metadata is unavailable", async (t) => {
  const { baseUrl } = await startSpaFallbackTestServer(t, {
    overrides: {
      getSharedCapsuleOgMetadataImpl: async () => null
    }
  });

  const { response, text } = await requestText(baseUrl, "/share/missing-share");

  assert.equal(response.status, 200);
  assert.match(text, /<title>Capsule Wardrobe<\/title>/);
  assert.equal(text.includes("property=\"og:title\""), false);
  assert.equal(text.includes("property=\"og:description\""), false);
  assert.equal(text.includes("property=\"og:image\""), false);
  assert.equal(text.includes("property=\"og:url\""), false);
});
