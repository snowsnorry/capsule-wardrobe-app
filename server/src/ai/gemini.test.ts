import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_CHAT_MODELS,
  buildGeminiContents,
  buildGeminiSystemInstruction,
  createGeminiClient,
  generateJsonWithLlm,
  resolveChatModel
} from "./gemini.js";
import { buildSystemPrompt } from "./llm.js";
import type { JsonSchemaFormat } from "./types.js";

function assertGeminiObjectSchema(
  schema: unknown
): asserts schema is {
  type?: string;
  additionalProperties?: boolean;
  properties?: Record<string, { type?: string }>;
} {
  assert.ok(Boolean(schema) && typeof schema === "object" && !Array.isArray(schema));
}

const SIMPLE_OK_FORMAT: JsonSchemaFormat = {
  type: "json_schema",
  name: "simple_ok_response",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ok: { type: "boolean" }
    },
    required: ["ok"]
  }
};

test("resolveChatModel keeps only supported gemini profile models", () => {
  assert.equal(resolveChatModel({ llm: "gemini:gemini-2.5-pro" }), "gemini-2.5-pro");
  assert.equal(resolveChatModel({ llm: "gemini:unknown-model" }), ALLOWED_CHAT_MODELS[0]);
  assert.equal(resolveChatModel({ llm: "openai:gpt-5.5" }), ALLOWED_CHAT_MODELS[0]);
});

test("buildGeminiContents emits text and fileData parts", () => {
  const content = buildGeminiContents("Describe capsule", [{
    uri: "gs://gemini/files/123",
    mimeType: "image/png"
  }]);

  assert.deepEqual(content[0], {
    fileData: {
      fileUri: "gs://gemini/files/123",
      mimeType: "image/png"
    }
  });
  assert.deepEqual(content[1], { text: "Describe capsule" });
});

test("buildGeminiSystemInstruction concatenates system and system prompt", () => {
  const userProfile = {
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"]
  };

  assert.equal(
    buildGeminiSystemInstruction("Be concise", userProfile),
    `Be concise\n\n${buildSystemPrompt(userProfile)}`
  );
});

test("buildGeminiSystemInstruction uses explicit system prompt override", () => {
  assert.equal(
    buildGeminiSystemInstruction("Be concise", { style: "minimalistic" }, "Override system"),
    "Be concise\n\nOverride system"
  );
});

test("buildGeminiSystemInstruction returns only system prompt when system is empty", () => {
  const userProfile = { style: "minimalistic" };

  assert.equal(
    buildGeminiSystemInstruction("", userProfile),
    buildSystemPrompt(userProfile)
  );
});

test("buildGeminiSystemInstruction includes the default system prompt for a neutral profile", () => {
  assert.equal(
    buildGeminiSystemInstruction("Be concise", {}),
    `Be concise\n\n${buildSystemPrompt({})}`
  );
});

test("gemini client validates api key and shapes multimodal JSON request", async () => {
  let createdCount = 0;
  let requestPayload = null;
  let clientInitOptions = null;
  const uploadedImages = [];
  const deletedImages = [];
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: ({ apiKey, apiVersion, httpOptions }) => {
      createdCount += 1;
      clientInitOptions = { apiKey, apiVersion, httpOptions };
      return {
        apiKey,
        apiVersion,
        models: {
          generateContent: async (payload) => {
            requestPayload = payload;
            return { text: "noise before {\"ok\":true} trailing", candidates: [] };
          }
        },
        files: {
          upload: async () => ({ name: "files/ignore" }),
          delete: async ({ name }) => {
            deletedImages.push(name);
            return {};
          }
        }
      };
    },
    uploadBufferToGeminiImpl: async (_client, image) => {
      uploadedImages.push(image?.filename || null);
      return {
        name: `files/${uploadedImages.length}`,
        uri: `gs://gemini/files/${uploadedImages.length}`,
        mimeType: image?.mimeType || "image/jpeg"
      };
    }
  });

  const first = client.getGeminiClient();
  const second = client.getGeminiClient();
  assert.equal(createdCount, 1);
  assert.equal(first, second);
  assert.equal(first.apiKey, "gem-key");
  assert.equal(first.apiVersion, "v1beta");
  assert.deepEqual(clientInitOptions, {
    apiKey: "gem-key",
    apiVersion: "v1beta",
    httpOptions: {
      timeout: 120000
    }
  });

  const images = [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }];
  let payloadBuiltCalls = 0;
  const result = await client.generateJsonWithLlm("Return JSON", {
    userProfile: {
      llm: "gemini:gemini-2.5-pro",
      audience: "woman",
      formalityLevel: "formal",
      season: ["winter"]
    },
    format: SIMPLE_OK_FORMAT,
    images,
    onPayloadBuilt: () => {
      payloadBuiltCalls += 1;
    }
  });

  assert.deepEqual(result.json, { ok: true });
  assert.equal(requestPayload.model, "gemini-2.5-pro");
  assert.equal(
    requestPayload.config.systemInstruction,
    buildSystemPrompt({
      llm: "gemini:gemini-2.5-pro",
      audience: "woman",
      formalityLevel: "formal",
      season: ["winter"]
    })
  );
  assert.equal(requestPayload.config.responseMimeType, "application/json");
  assertGeminiObjectSchema(requestPayload.config.responseJsonSchema);
  assert.equal(requestPayload.config.responseJsonSchema.type, "object");
  assert.equal(requestPayload.config.responseJsonSchema.properties?.ok.type, "boolean");
  assert.deepEqual(requestPayload.contents[0], {
    fileData: {
      fileUri: "gs://gemini/files/1",
      mimeType: "image/png"
    }
  });
  assert.equal(requestPayload.contents[1].text, "Return JSON");
  assert.equal(payloadBuiltCalls, 1);
  assert.equal(images[0].buffer, null);
  assert.deepEqual(uploadedImages, [null]);
  assert.deepEqual(deletedImages, ["files/1"]);

  const missingKeyClient = createGeminiClient({ getApiKeyImpl: () => "" });
  assert.throws(() => missingKeyClient.getGeminiClient(), /GEMINI_API_KEY is not set/);
});

test("gemini uses only system prompt as systemInstruction when prompt has no System block", async () => {
  let requestPayload = null;
  const userProfile = {
    style: "minimalistic",
    audience: "woman",
    formalityLevel: "smart_casual",
    occasions: ["everyday_errands"]
  };
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: () => ({
      models: {
        generateContent: async (payload) => {
          requestPayload = payload;
          return { text: "{\"ok\":true}", candidates: [] };
        }
      },
      files: {
        upload: async () => ({ name: "files/ignore" }),
        delete: async () => ({})
      }
    })
  });

  await client.generateJsonWithLlm("Return JSON", {
    userProfile,
    format: SIMPLE_OK_FORMAT
  });

  assert.equal(requestPayload.config.systemInstruction, buildSystemPrompt(userProfile));
  assert.equal(requestPayload.contents[0].text, "Return JSON");
});

test("gemini generateJsonWithLlm throws for invalid JSON", async () => {
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: () => ({
      models: {
        generateContent: async () => ({ text: "not-json", candidates: [] })
      },
      files: {
        upload: async () => ({ name: "files/1" }),
        delete: async () => ({})
      }
    })
  });

  await assert.rejects(
    () => client.generateJsonWithLlm("User: Return JSON"),
    /Failed to parse JSON response/
  );
});

test("gemini generateJsonWithLlm throws when parsed JSON does not satisfy the schema", async () => {
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: () => ({
      models: {
        generateContent: async () => ({ text: "{\"ok\":\"yes\"}", candidates: [] })
      },
      files: {
        upload: async () => ({ name: "files/1" }),
        delete: async () => ({})
      }
    })
  });

  await assert.rejects(
    () => client.generateJsonWithLlm("User: Return JSON", {
      format: {
        ...SIMPLE_OK_FORMAT
      }
    }),
    /Failed to parse JSON response/
  );
});

test("gemini does not retry transient transport failures", async () => {
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: () => ({
      models: {
        generateContent: async () => {
          const error = new TypeError("fetch failed");
          (error as Error & { cause?: { code?: string } }).cause = { code: "UND_ERR_SOCKET" };
          throw error;
        }
      },
      files: {
        upload: async () => ({ name: "files/1" }),
        delete: async () => ({})
      }
    })
  });

  await assert.rejects(
    () => client.generateJsonWithLlm("User: Return JSON"),
    /fetch failed/
  );
});

test("module-level gemini generateJsonWithLlm validates api key", async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  try {
    await assert.rejects(() => generateJsonWithLlm("User: Return JSON"), /GEMINI_API_KEY is not set/);
  } finally {
    process.env.GEMINI_API_KEY = originalApiKey;
  }
});
