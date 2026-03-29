import test from "node:test";
import assert from "node:assert/strict";
import { createVoyageClient, getWardrobePrompt } from "./ai/voyageai.js";

test("getWardrobePrompt builds a semantic query from profile filters", () => {
  const prompt = getWardrobePrompt({
    audience: "woman",
    formalityLevel: "smart_casual",
    season: ["spring", "summer"],
    occasions: ["office", "brunch"],
    style: "minimalistic",
    color: "burgundy",
    pattern: "striped"
  });

  assert.match(prompt, /Looking for woman's fashion items and clothing\./);
  assert.match(prompt, /Suitable for a smart_casual dress code during the spring, summer season\./);
  assert.match(prompt, /Ideal for office, brunch\./);
  assert.match(prompt, /Designed in a minimalistic style\./);
  assert.match(prompt, /Preferred color: burgundy\./);
  assert.match(prompt, /Features a striped pattern\./);
});

test("voyage client requires api key and shapes embedding request", async () => {
  let requestUrl = null;
  let requestInit = null;
  const client = createVoyageClient({
    getVoyageApiKeyImpl: () => "voyage-key",
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return {
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }]
        })
      };
    }
  });

  const embedding = await client.getPromptEmbeddings("capsule prompt");
  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);
  assert.equal(requestUrl, "https://api.voyageai.com/v1/embeddings");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.headers.Authorization, "Bearer voyage-key");
  assert.deepEqual(JSON.parse(requestInit.body), {
    input: "capsule prompt",
    model: "voyage-4-large",
    input_type: "query"
  });
});

test("voyage client throws for missing key, http failure, and invalid embedding payload", async () => {
  const missingKeyClient = createVoyageClient({
    getVoyageApiKeyImpl: () => {
      throw new Error("VOYAGE_API_KEY is not set");
    },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });
  await assert.rejects(
    () => missingKeyClient.getPromptEmbeddings("prompt"),
    /VOYAGE_API_KEY is not set/
  );

  const httpFailureClient = createVoyageClient({
    getVoyageApiKeyImpl: () => "voyage-key",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      text: async () => "bad gateway"
    })
  });
  await assert.rejects(
    () => httpFailureClient.getPromptEmbeddings("prompt"),
    /Failed to compute prompt embeddings: 502 bad gateway/
  );

  const invalidPayloadClient = createVoyageClient({
    getVoyageApiKeyImpl: () => "voyage-key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [] }] })
    })
  });
  await assert.rejects(
    () => invalidPayloadClient.getPromptEmbeddings("prompt"),
    /Failed to compute prompt embeddings/
  );
});
