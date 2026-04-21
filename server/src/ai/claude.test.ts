import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(part.type, "image");
}

test("resolveChatModel keeps only supported claude profile models", () => {
  assert.equal(resolveChatModel({ llm: "claude:claude-opus-4-7" }), "claude-opus-4-7");
  assert.equal(resolveChatModel({ llm: "claude:unknown-model" }), ALLOWED_CHAT_MODELS[0]);
  assert.equal(resolveChatModel({ llm: "openai:gpt-5.2" }), ALLOWED_CHAT_MODELS[0]);
});

test("buildClaudeSystemPrompt concatenates system and system prompt", () => {
  const userProfile = {
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"]
  };

  assert.equal(
    buildClaudeSystemPrompt("Be concise", userProfile),
    `Be concise\n\n${buildSystemPrompt(userProfile)}`
  );
});

test("buildClaudeSystemPrompt uses explicit system prompt override", () => {
  assert.equal(
    buildClaudeSystemPrompt("Be concise", { style: "minimalistic" }, "Override system"),
    "Be concise\n\nOverride system"
  );
});

test("buildClaudeMessages creates Anthropic multimodal user content", () => {
  const messages = buildClaudeMessages("Describe this", [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one"),
    category: "top",
    filename: "top.png"
  }]);

  assert.equal(messages[0].role, "user");
  assertClaudeImagePart(messages[0].content[0]);
  assert.equal(messages[0].content[0].source.type, "base64");
  assert.equal(messages[0].content[0].source.media_type, "image/png");
  assert.equal(messages[0].content[0].source.data, Buffer.from("image-one").toString("base64"));
  assert.deepEqual(messages[0].content[1], {
    type: "text",
    text: "Describe this"
  });
});

test("buildClaudeOutputConfig maps app format to Anthropic structured output config", () => {
  assert.deepEqual(
    buildClaudeOutputConfig({
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
    }),
    {
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
    }
  );
});

test("sanitizeClaudeJsonSchema clamps unsupported array minItems values", () => {
  assert.deepEqual(
    sanitizeClaudeJsonSchema({
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
    }),
    {
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
    }
  );
});

test("extractClaudeResponseText joins text content blocks", () => {
  assert.equal(extractClaudeResponseText({
    content: [
      { type: "text", text: "{" },
      { type: "tool_use", name: "skip" },
      { type: "text", text: "\"ok\":true}" }
    ]
  }), "{\"ok\":true}");
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
  assert.equal(createdCount, 1);
  assert.equal(first, second);
  assert.equal(first.apiKey, "anth-key");

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

  assert.deepEqual(result.json, { ok: true });
  assert.equal(requestPayload.model, "claude-opus-4-7");
  assert.equal(
    requestPayload.system,
    buildSystemPrompt(userProfile)
  );
  assertClaudeImagePart(requestPayload.messages[0].content[0]);
  assert.equal(requestPayload.output_config.format.type, "json_schema");
  assert.equal(requestPayload.output_config.format.schema.type, "object");
  assert.equal(requestPayload.output_config.format.schema.properties.capsule.properties.top.minItems, 1);
  assert.deepEqual(requestPayload.messages[0].content.at(-1), {
    type: "text",
    text: "Return JSON"
  });
  assert.equal(payloadBuiltCalls, 1);
  assert.equal(images[0].buffer, null);

  const missingKeyClient = createClaudeClient({ getApiKeyImpl: () => "" });
  assert.throws(() => missingKeyClient.getClaudeClient(), /ANTHROPIC_API_KEY is not set/);
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

  await assert.rejects(
    () => client.generateJsonWithLlm("User: Return JSON"),
    /Failed to parse JSON response/
  );
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

  await assert.rejects(
    () => client.generateJsonWithLlm("User: Return JSON"),
    /fetch failed/
  );
});

test("module-level claude generateJsonWithLlm validates api key", async () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "";
  try {
    await assert.rejects(() => generateJsonWithLlm("User: Return JSON"), /ANTHROPIC_API_KEY is not set/);
  } finally {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  }
});
