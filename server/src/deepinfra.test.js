import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeepInfraClient,
  splitSystemAndUserPrompt
} from "./ai/deepinfra.js";

test("splitSystemAndUserPrompt extracts system and user sections or falls back to plain user text", () => {
  assert.deepEqual(
    splitSystemAndUserPrompt("System: Be concise\nUser: Return JSON"),
    {
      system: "Be concise",
      user: "Return JSON"
    }
  );

  assert.deepEqual(
    splitSystemAndUserPrompt("Plain prompt"),
    {
      system: "",
      user: "Plain prompt"
    }
  );
});

test("deepinfra client validates api key and caches constructed client", () => {
  let createdCount = 0;
  const client = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: ({ apiKey, baseURL }) => {
      createdCount += 1;
      return { apiKey, baseURL, embeddings: {}, chat: { completions: {} } };
    }
  });

  const first = client.getOpenAiClient();
  const second = client.getOpenAiClient();
  assert.equal(createdCount, 1);
  assert.equal(first, second);
  assert.equal(first.apiKey, "deep-key");
  assert.equal(first.baseURL, "https://api.deepinfra.com/v1/openai");

  const missingKeyClient = createDeepInfraClient({
    getApiKeyImpl: () => ""
  });
  assert.throws(() => missingKeyClient.getOpenAiClient(), /DEEPINFRA_API_KEY is not set/);
});

test("deepinfra client shapes embedding and chat requests and parses JSON output", async () => {
  let embeddingPayload = null;
  let chatPayload = null;
  const client = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: () => ({
      embeddings: {
        create: async (payload) => {
          embeddingPayload = payload;
          return { data: [{ embedding: [0.4, 0.5] }] };
        }
      },
      chat: {
        completions: {
          create: async (payload) => {
            chatPayload = payload;
            return {
              choices: [{
                message: {
                  content: "noise before {\"ok\":true} trailing"
                }
              }]
            };
          }
        }
      }
    })
  });

  const embedding = await client.getPromptEmbeddings("prompt");
  assert.deepEqual(embedding, [0.4, 0.5]);
  assert.deepEqual(embeddingPayload, {
    model: "google/embeddinggemma-300m",
    input: "prompt"
  });

  const result = await client.generateJsonWithLlm("System: Be concise\nUser: Return JSON");
  assert.deepEqual(result.json, { ok: true });
  assert.equal(chatPayload.model, "meta-llama/Llama-3.3-70B-Instruct-Turbo");
  assert.deepEqual(chatPayload.messages, [
    { role: "system", content: "Be concise" },
    { role: "user", content: "Return JSON" }
  ]);
  assert.deepEqual(chatPayload.response_format, { type: "json_object" });
});

test("deepinfra client throws for invalid embedding and invalid chat JSON", async () => {
  const badEmbeddingClient = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: () => ({
      embeddings: {
        create: async () => ({ data: [{ embedding: [] }] })
      },
      chat: {
        completions: {
          create: async () => ({ choices: [{ message: { content: "{}" } }] })
        }
      }
    })
  });
  await assert.rejects(
    () => badEmbeddingClient.getPromptEmbeddings("prompt"),
    /Failed to compute prompt embeddings/
  );

  const badJsonClient = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: () => ({
      embeddings: {
        create: async () => ({ data: [{ embedding: [1] }] })
      },
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "not-json" } }]
          })
        }
      }
    })
  });
  await assert.rejects(
    () => badJsonClient.generateJsonWithLlm("User: Return JSON"),
    /Failed to parse JSON response/
  );
});
