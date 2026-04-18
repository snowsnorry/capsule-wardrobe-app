import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_CHAT_MODELS,
  buildChatMessages,
  collectStreamText,
  createDeepInfraClient,
  estimateJsonByteLength,
  extractChunkText,
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
    createClientImpl: ({ apiKey, baseURL, maxRetries }) => {
      createdCount += 1;
      return { apiKey, baseURL, maxRetries, embeddings: {}, chat: { completions: {} } };
    }
  });

  const first = client.getOpenAiClient();
  const second = client.getOpenAiClient();
  assert.equal(createdCount, 1);
  assert.equal(first, second);
  assert.equal(first.apiKey, "deep-key");
  assert.equal(first.baseURL, "https://api.deepinfra.com/v1/openai");
  assert.equal(first.maxRetries, 0);

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

  assert.equal(content[0].type, "image_url");
  assert.match(content[0].image_url.url, /^data:image\/png;base64,/);
  assert.deepEqual(content[1], {
    type: "text",
    text: "Describe capsule"
  });
});

test("estimateJsonByteLength returns a utf8 byte count for json payloads", () => {
  assert.equal(estimateJsonByteLength({ ok: true }), Buffer.byteLength("{\"ok\":true}", "utf8"));
});

test("extractChunkText and collectStreamText accumulate streaming delta content", async () => {
  assert.equal(extractChunkText({
    choices: [{ delta: { content: "{\"ok\":" } }]
  }), "{\"ok\":");
  assert.equal(extractChunkText({
    choices: [{ delta: { content: [{ text: "true" }, { text: "}" }] } }]
  }), "true}");

  const stream = {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: "{\"ok\":" } }] };
      yield { choices: [{ delta: { content: "true" } }] };
      yield { choices: [{ delta: { content: "}" } }] };
    }
  };

  assert.equal(await collectStreamText(stream), "{\"ok\":true}");
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
              async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: "noise before " } }] };
                yield { choices: [{ delta: { content: "{\"ok\":true}" } }] };
                yield { choices: [{ delta: { content: " trailing" } }] };
              }
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
        {
          type: "image_url",
          image_url: {
            url: chatPayload.messages[1].content[0].image_url.url
          }
        },
        { type: "text", text: "Return JSON" }
      ]
    }
  ]);
  assert.deepEqual(chatPayload.response_format, { type: "json_object" });
  assert.equal(chatPayload.stream, true);
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
          create: async () => ({
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: "{}" } }] };
            }
          })
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
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: "not-json" } }] };
            }
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

test("deepinfra client logs transport diagnostics before rethrowing request errors", async () => {
  const warnings = [];
  const error = new Error("Connection error.");
  error.cause = {
    name: "FetchError",
    message: "socket hang up",
    code: "ECONNRESET",
    errno: "ECONNRESET"
  };

  const client = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    nowImpl: (() => {
      let tick = 0;
      return () => {
        tick += 1;
        return tick === 1 ? 1000 : 1125;
      };
    })(),
    warnImpl: (...args) => warnings.push(args),
    createClientImpl: () => ({
      embeddings: {
        create: async () => ({ data: [{ embedding: [1] }] })
      },
      chat: {
        completions: {
          create: async () => {
            throw error;
          }
        }
      }
    })
  });

  await assert.rejects(
    () => client.generateJsonWithLlm("System: Be concise\nUser: Return JSON", {
      userProfile: { llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" },
      images: [{ mimeType: "image/png", buffer: Buffer.from("image-one") }]
    }),
    /Connection error/
  );

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "[deepinfra][request-failed]");
  const payload = JSON.parse(warnings[0][1]);
  assert.equal(payload.model, "Qwen/Qwen3-VL-235B-A22B-Instruct");
  assert.equal(payload.durationMs, 125);
  assert.equal(payload.imageCount, 1);
  assert.equal(payload.causeName, "FetchError");
  assert.equal(payload.causeMessage, "socket hang up");
  assert.equal(payload.causeCode, "ECONNRESET");
  assert.equal(payload.causeErrno, "ECONNRESET");
  assert.equal(typeof payload.payloadBytes, "number");
});
