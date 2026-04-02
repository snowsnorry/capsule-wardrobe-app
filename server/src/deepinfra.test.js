import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_CHAT_MODELS,
  buildChatMessages,
  createDeepInfraClient,
  resolveChatModel,
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

test("resolveChatModel keeps only supported deepinfra profile models", () => {
  assert.equal(resolveChatModel({ llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" }), "Qwen/Qwen3-VL-235B-A22B-Instruct");
  assert.equal(resolveChatModel({ llm: "deepinfra:not-supported" }), ALLOWED_CHAT_MODELS[0]);
  assert.equal(resolveChatModel({ llm: "openai:gpt-5.2" }), ALLOWED_CHAT_MODELS[0]);
});

test("buildChatMessages emits multimodal user content and preserves images", () => {
  const content = buildChatMessages("Describe capsule", [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }]);

  assert.deepEqual(content[0], {
    type: "text",
    text: "Describe capsule"
  });
  assert.equal(content[1].type, "image_url");
  assert.match(content[1].image_url.url, /^data:image\/png;base64,/);
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

  const images = [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }];
  let payloadBuiltCalls = 0;

  const result = await client.generateJsonWithLlm("System: Be concise\nUser: Return JSON", {
    userProfile: { llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" },
    format: { ignored: true },
    images,
    onPayloadBuilt: () => {
      payloadBuiltCalls += 1;
    }
  });
  assert.deepEqual(result.json, { ok: true });
  assert.equal(chatPayload.model, "Qwen/Qwen3-VL-235B-A22B-Instruct");
  assert.deepEqual(chatPayload.messages, [
    { role: "system", content: "Be concise" },
    {
      role: "user",
      content: [
        { type: "text", text: "Return JSON" },
        {
          type: "image_url",
          image_url: {
            url: chatPayload.messages[1].content[1].image_url.url
          }
        }
      ]
    }
  ]);
  assert.deepEqual(chatPayload.response_format, { type: "json_object" });
  assert.equal(payloadBuiltCalls, 1);
  assert.equal(images[0].buffer, null);
  assert.equal(result.response.output_text, "noise before {\"ok\":true} trailing");
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
