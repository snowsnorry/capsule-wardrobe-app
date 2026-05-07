import { test, expect, vi } from "vitest";
import {
  ALLOWED_CHAT_MODELS,
  buildChatMessages,
  collectStreamText,
  createDeepInfraClient,
  estimateJsonByteLength,
  extractChunkText,
  resolveChatModel,
} from "./deepinfra.js";
import { buildSystemPrompt, splitSystemAndUserPrompt } from "./llm.js";

function assertDeepInfraImagePart(part: {
  type?: string;
  image_url?: { url?: string };
}): asserts part is { type: "image_url"; image_url: { url: string } } {
  expect(part.type).toBe("image_url");
}

test("splitSystemAndUserPrompt extracts system and user sections or falls back to plain user text", () => {
  expect(
    splitSystemAndUserPrompt("System: Be concise\nUser: Return JSON"),
  ).toEqual({
    system: "Be concise",
    user: "Return JSON",
  });

  expect(splitSystemAndUserPrompt("Plain prompt")).toEqual({
    system: "",
    user: "Plain prompt",
  });
});

test("deepinfra client validates api key and caches constructed client", () => {
  let createdCount = 0;
  const client = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: ({ apiKey, baseURL, maxRetries }) => {
      createdCount += 1;
      return {
        apiKey,
        baseURL,
        maxRetries,
        embeddings: {
          create: async () => ({ data: [{ embedding: [1] }] }),
        },
        chat: {
          completions: {
            create: async () => ({
              async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: "{}" } }] };
              },
            }),
          },
        },
      };
    },
  });

  const first = client.getOpenAiClient();
  const second = client.getOpenAiClient();
  expect(createdCount).toBe(1);
  expect(first).toBe(second);
  expect(first.apiKey).toBe("deep-key");
  expect(first.baseURL).toBe("https://api.deepinfra.com/v1/openai");
  expect(first.maxRetries).toBe(0);

  const missingKeyClient = createDeepInfraClient({
    getApiKeyImpl: () => "",
  });
  expect(() => missingKeyClient.getOpenAiClient()).toThrow(
    /DEEPINFRA_API_KEY is not set/,
  );
});

test("resolveChatModel keeps only supported deepinfra profile models", () => {
  expect(
    resolveChatModel({ llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" }),
  ).toBe("Qwen/Qwen3-VL-235B-A22B-Instruct");
  expect(resolveChatModel({ llm: "deepinfra:not-supported" })).toBe(
    ALLOWED_CHAT_MODELS[0],
  );
  expect(resolveChatModel({ llm: "openai:gpt-5.5" })).toBe(
    ALLOWED_CHAT_MODELS[0],
  );
});

test("buildChatMessages emits multimodal user content and preserves images", () => {
  const content = buildChatMessages("Describe capsule", [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one"),
    },
  ]);

  assertDeepInfraImagePart(content[0]);
  expect(content[0].image_url.url).toMatch(/^data:image\/png;base64,/);
  expect(content[1]).toEqual({
    type: "text",
    text: "Describe capsule",
  });
});

test("buildChatMessages trims empty prompts and skips unusable image assets", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  try {
    expect(buildChatMessages("   ")).toEqual([{ type: "text", text: "" }]);

    const content = buildChatMessages("Describe remaining images", [
      {
        category: "top",
        filename: "missing.jpg",
        buffer: null,
      },
      {
        buffer: Buffer.from("image-two"),
      },
    ]);

    assertDeepInfraImagePart(content[0]);
    expect(content[0].image_url.url).toMatch(/^data:image\/png;base64,/);
    expect(content[1]).toEqual({
      type: "text",
      text: "Describe remaining images",
    });
    expect(warn).toHaveBeenCalledWith(
      "[deepinfra][image-skipped]",
      expect.stringContaining('"filename":"missing.jpg"'),
    );
  } finally {
    warn.mockRestore();
  }
});

test("estimateJsonByteLength returns a utf8 byte count for json payloads", () => {
  expect(estimateJsonByteLength({ ok: true })).toBe(
    Buffer.byteLength('{"ok":true}', "utf8"),
  );
});

test("extractChunkText and collectStreamText accumulate streaming delta content", async () => {
  expect(
    extractChunkText({
      choices: [{ delta: { content: '{"ok":' } }],
    }),
  ).toBe('{"ok":');
  expect(
    extractChunkText({
      choices: [{ delta: { content: [{ text: "true" }, { text: "}" }] } }],
    }),
  ).toBe("true}");

  const stream = {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: '{"ok":' } }] };
      yield { choices: [{ delta: { content: "true" } }] };
      yield { choices: [{ delta: { content: "}" } }] };
    },
  };

  expect(await collectStreamText(stream)).toBe('{"ok":true}');
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
        },
      },
      chat: {
        completions: {
          create: async (payload) => {
            chatPayload = payload;
            return {
              async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: "noise before " } }] };
                yield { choices: [{ delta: { content: '{"ok":true}' } }] };
                yield { choices: [{ delta: { content: " trailing" } }] };
              },
            };
          },
        },
      },
    }),
  });

  const embedding = await client.getPromptEmbeddings("prompt");
  expect(embedding).toEqual([0.4, 0.5]);
  expect(embeddingPayload).toEqual({
    model: "google/embeddinggemma-300m",
    input: "prompt",
  });

  const images = [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one"),
    },
  ];
  let payloadBuiltCalls = 0;

  const userProfile = { llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" };
  const result = await client.generateJsonWithLlm("Return JSON", {
    userProfile,
    format: null,
    images,
    onPayloadBuilt: () => {
      payloadBuiltCalls += 1;
    },
  });
  expect(result.json).toEqual({ ok: true });
  expect(chatPayload.model).toBe("Qwen/Qwen3-VL-235B-A22B-Instruct");
  assertDeepInfraImagePart(chatPayload.messages[1].content[0]);
  expect(chatPayload.messages).toEqual([
    { role: "system", content: buildSystemPrompt(userProfile) },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: chatPayload.messages[1].content[0].image_url.url,
          },
        },
        { type: "text", text: "Return JSON" },
      ],
    },
  ]);
  expect(chatPayload.response_format).toEqual({ type: "json_object" });
  expect(chatPayload.stream).toBe(true);
  expect(payloadBuiltCalls).toBe(1);
  expect(images[0].buffer).toBe(null);
  expect(result.response.output_text).toBe('noise before {"ok":true} trailing');
});

test("deepinfra client uses explicit system prompt override", async () => {
  let chatPayload;
  const client = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: () => ({
      embeddings: {
        create: async () => ({ data: [{ embedding: [0.4, 0.5] }] }),
      },
      chat: {
        completions: {
          create: async (payload) => {
            chatPayload = payload;
            return {
              async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: '{"ok":true}' } }] };
              },
            };
          },
        },
      },
    }),
  });

  await client.generateJsonWithLlm("System: Be concise\nUser: Return JSON", {
    userProfile: { llm: "deepinfra:google/gemma-4-31B-it" },
    systemPrompt: "Override system",
  });

  expect(chatPayload.messages[0].content).toBe("Be concise\n\nOverride system");
});

test("deepinfra client throws for invalid embedding and invalid chat JSON", async () => {
  const badEmbeddingClient = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: () => ({
      embeddings: {
        create: async () => ({ data: [{ embedding: [] }] }),
      },
      chat: {
        completions: {
          create: async () => ({
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: "{}" } }] };
            },
          }),
        },
      },
    }),
  });
  await expect(() =>
    badEmbeddingClient.getPromptEmbeddings("prompt"),
  ).rejects.toThrow(/Failed to compute prompt embeddings/);

  const badJsonClient = createDeepInfraClient({
    getApiKeyImpl: () => "deep-key",
    createClientImpl: () => ({
      embeddings: {
        create: async () => ({ data: [{ embedding: [1] }] }),
      },
      chat: {
        completions: {
          create: async () => ({
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: "not-json" } }] };
            },
          }),
        },
      },
    }),
  });
  await expect(() =>
    badJsonClient.generateJsonWithLlm("User: Return JSON"),
  ).rejects.toThrow(/Failed to parse JSON response/);
});

test("deepinfra client logs transport diagnostics before rethrowing request errors", async () => {
  const warnings = [];
  const error = new Error("Connection error.");
  (error as Error & { cause?: Record<string, unknown> }).cause = {
    name: "FetchError",
    message: "socket hang up",
    code: "ECONNRESET",
    errno: "ECONNRESET",
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
        create: async () => ({ data: [{ embedding: [1] }] }),
      },
      chat: {
        completions: {
          create: async () => {
            throw error;
          },
        },
      },
    }),
  });

  await expect(() =>
    client.generateJsonWithLlm("System: Be concise\nUser: Return JSON", {
      userProfile: { llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" },
      images: [{ mimeType: "image/png", buffer: Buffer.from("image-one") }],
    }),
  ).rejects.toThrow(/Connection error/);

  expect(warnings.length).toBe(1);
  expect(warnings[0][0]).toBe("[deepinfra][request-failed]");
  const payload = JSON.parse(warnings[0][1]);
  expect(payload.model).toBe("Qwen/Qwen3-VL-235B-A22B-Instruct");
  expect(payload.durationMs).toBe(125);
  expect(payload.imageCount).toBe(1);
  expect(payload.causeName).toBe("FetchError");
  expect(payload.causeMessage).toBe("socket hang up");
  expect(payload.causeCode).toBe("ECONNRESET");
  expect(payload.causeErrno).toBe("ECONNRESET");
  expect(typeof payload.payloadBytes).toBe("number");
});
