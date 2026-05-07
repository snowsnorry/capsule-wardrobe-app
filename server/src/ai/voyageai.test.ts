import { test, expect } from "vitest";
import { createVoyageClient, getWardrobePrompt } from "./voyageai.js";

test("getWardrobePrompt builds a semantic query from profile filters", () => {
  const prompt = getWardrobePrompt({
    audience: "woman",
    formalityLevel: "smart_casual",
    season: ["spring", "summer"],
    occasions: ["office", "brunch"],
    style: "minimalistic",
    color: "burgundy",
    pattern: "striped",
    text: "Prefer natural fabrics and no oversized fits"
  });

  expect(prompt).toMatch(/Looking for woman's fashion items and clothing\./);
  expect(prompt).toMatch(/Suitable for a smart_casual dress code during the spring, summer season\./);
  expect(prompt).toMatch(/Ideal for office, brunch\./);
  expect(prompt).toMatch(/Designed in a minimalistic style\./);
  expect(prompt).toMatch(/Preferred color: burgundy\./);
  expect(prompt).toMatch(/Features a striped pattern\./);
  expect(prompt).toMatch(/Additional request: Prefer natural fabrics and no oversized fits\./);
});

test("getWardrobePrompt omits additional request for blank text", () => {
  const prompt = getWardrobePrompt({
    audience: "woman",
    text: "   "
  });

  expect(prompt).not.toMatch(/Additional request:/);
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
  expect(embedding).toEqual([0.1, 0.2, 0.3]);
  expect(requestUrl).toBe("https://api.voyageai.com/v1/embeddings");
  expect(requestInit.method).toBe("POST");
  expect(requestInit.headers.Authorization).toBe("Bearer voyage-key");
  expect(JSON.parse(requestInit.body)).toEqual({
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
  await expect(() => missingKeyClient.getPromptEmbeddings("prompt")).rejects.toThrow(/VOYAGE_API_KEY is not set/);

  const httpFailureClient = createVoyageClient({
    getVoyageApiKeyImpl: () => "voyage-key",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      text: async () => "bad gateway"
    })
  });
  await expect(() => httpFailureClient.getPromptEmbeddings("prompt")).rejects.toThrow(/Failed to compute prompt embeddings: 502 bad gateway/);

  const invalidPayloadClient = createVoyageClient({
    getVoyageApiKeyImpl: () => "voyage-key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [] }] })
    })
  });
  await expect(() => invalidPayloadClient.getPromptEmbeddings("prompt")).rejects.toThrow(/Failed to compute prompt embeddings/);
});
