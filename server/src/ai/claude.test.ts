import { test, expect } from "vitest";
import {
  ALLOWED_CHAT_MODELS,
  buildClaudeMessages,
  buildClaudeOutputConfig,
  buildClaudeSystemPrompt,
  createClaudeClient,
  extractClaudeResponseText,
  generateJsonWithLlm,
  sanitizeClaudeJsonSchema,
  resolveChatModel
} from "./claude.js";
import { buildSystemPrompt } from "./llm.js";

function assertClaudeImagePart(
  part: { type?: string; source?: { type?: string; media_type?: string; data?: string } }
): asserts part is { type: "image"; source: { type: "base64"; media_type: string; data: string } } {
  expect(part.type).toBe("image");
}

test("resolveChatModel keeps only supported claude profile models", () => {
  expect(resolveChatModel({ llm: "claude:claude-opus-4-7" })).toBe("claude-opus-4-7");
  expect(resolveChatModel({ llm: "claude:unknown-model" })).toBe(ALLOWED_CHAT_MODELS[0]);
  expect(resolveChatModel({ llm: "openai:gpt-5.5" })).toBe(ALLOWED_CHAT_MODELS[0]);
});

test("buildClaudeSystemPrompt concatenates system and system prompt", () => {
  const userProfile = {
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"]
  };

  expect(buildClaudeSystemPrompt("Be concise", userProfile)).toBe(`Be concise\n\n${buildSystemPrompt(userProfile)}`
  );
});

test("buildClaudeSystemPrompt uses explicit system prompt override", () => {
  expect(buildClaudeSystemPrompt("Be concise", { style: "minimalistic" }, "Override system")).toBe("Be concise\n\nOverride system");
});

test("buildClaudeMessages creates Anthropic multimodal user content", () => {
  const messages = buildClaudeMessages("Describe this", [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one"),
    category: "top",
    filename: "top.png"
  }]);

  expect(messages[0].role).toBe("user");
  assertClaudeImagePart(messages[0].content[0]);
  expect(messages[0].content[0].source.type).toBe("base64");
  expect(messages[0].content[0].source.media_type).toBe("image/png");
  expect(messages[0].content[0].source.data).toBe(Buffer.from("image-one").toString("base64"));
  expect(messages[0].content[1]).toEqual({
    type: "text",
    text: "Describe this"
  });
});

test("buildClaudeOutputConfig maps app format to Anthropic structured output config", () => {
  expect(buildClaudeOutputConfig({
      type: "json_schema",
      name: "example",
      description: "ignored by claude request builder",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean" }
        },
        required: ["ok"]
      }
    })).toEqual({
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" }
          },
          required: ["ok"]
        }
      }
    });
});

test("sanitizeClaudeJsonSchema clamps unsupported array minItems values", () => {
  expect(sanitizeClaudeJsonSchema({
      type: "object",
      properties: {
        outfit_formulas: {
          type: "array",
          minItems: 4,
          maxItems: 6,
          items: { type: "string" }
        },
        capsule: {
          type: "object",
          properties: {
            top: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "string" }
            }
          }
        }
      }
    })).toEqual({
      type: "object",
      properties: {
        outfit_formulas: {
          type: "array",
          minItems: 1,
          items: { type: "string" }
        },
        capsule: {
          type: "object",
          properties: {
            top: {
              type: "array",
              minItems: 1,
              items: { type: "string" }
            }
          }
        }
      }
    });
});

test("extractClaudeResponseText joins text content blocks", () => {
  expect(extractClaudeResponseText({
    content: [
      { type: "text", text: "{" },
      { type: "tool_use", name: "skip" },
      { type: "text", text: "\"ok\":true}" }
    ]
  })).toBe("{\"ok\":true}");
});

test("claude client validates api key, caches constructed client, and shapes multimodal JSON request", async () => {
  let createdCount = 0;
  let requestPayload = null;
  const client = createClaudeClient({
    getApiKeyImpl: () => "anth-key",
    createClientImpl: ({ apiKey }) => {
      createdCount += 1;
      return {
        apiKey,
        messages: {
          create: async (payload) => {
            requestPayload = payload;
            return {
              content: [{ type: "text", text: "noise before {\"ok\":true} trailing" }]
            };
          }
        }
      };
    }
  });

  const first = client.getClaudeClient();
  const second = client.getClaudeClient();
  expect(createdCount).toBe(1);
  expect(first).toBe(second);
  expect(first.apiKey).toBe("anth-key");

  const images = [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }];
  let payloadBuiltCalls = 0;
  const userProfile = {
    llm: "claude:claude-opus-4-7",
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"]
  };
  const result = await client.generateJsonWithLlm("Return JSON", {
    userProfile,
    images,
    onPayloadBuilt: () => {
      payloadBuiltCalls += 1;
    }
  });

  expect(result.json).toEqual({ ok: true });
  expect(requestPayload.model).toBe("claude-opus-4-7");
  expect(requestPayload.system).toBe(buildSystemPrompt(userProfile));
  assertClaudeImagePart(requestPayload.messages[0].content[0]);
  expect(requestPayload.output_config.format.type).toBe("json_schema");
  expect(requestPayload.output_config.format.schema.type).toBe("object");
  expect(requestPayload.output_config.format.schema.properties.capsule.properties.top.minItems).toBe(1);
  expect(requestPayload.messages[0].content.at(-1)).toEqual({
    type: "text",
    text: "Return JSON"
  });
  expect(payloadBuiltCalls).toBe(1);
  expect(images[0].buffer).toBe(null);

  const missingKeyClient = createClaudeClient({ getApiKeyImpl: () => "" });
  expect(() => missingKeyClient.getClaudeClient()).toThrow(/ANTHROPIC_API_KEY is not set/);
});

test("claude generateJsonWithLlm throws for invalid JSON", async () => {
  const client = createClaudeClient({
    getApiKeyImpl: () => "anth-key",
    createClientImpl: () => ({
      messages: {
        create: async () => ({
          content: [{ type: "text", text: "not-json" }]
        })
      }
    })
  });

  await expect(() => client.generateJsonWithLlm("User: Return JSON")).rejects.toThrow(/Failed to parse JSON response/);
});

test("claude does not retry transport failures", async () => {
  const client = createClaudeClient({
    getApiKeyImpl: () => "anth-key",
    createClientImpl: () => ({
      messages: {
        create: async () => {
          const error = new TypeError("fetch failed");
          (error as Error & { cause?: { code?: string } }).cause = { code: "UND_ERR_SOCKET" };
          throw error;
        }
      }
    })
  });

  await expect(() => client.generateJsonWithLlm("User: Return JSON")).rejects.toThrow(/fetch failed/);
});

test("module-level claude generateJsonWithLlm validates api key", async () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "";
  try {
    await expect(() => generateJsonWithLlm("User: Return JSON")).rejects.toThrow(/ANTHROPIC_API_KEY is not set/);
  } finally {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  }
});
