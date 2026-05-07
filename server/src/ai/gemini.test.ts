import { test, expect } from "vitest";
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
  expect(Boolean(schema) && typeof schema === "object" && !Array.isArray(schema)).toBeTruthy();
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
  expect(resolveChatModel({ llm: "gemini:gemini-2.5-pro" })).toBe("gemini-2.5-pro");
  expect(resolveChatModel({ llm: "gemini:unknown-model" })).toBe(ALLOWED_CHAT_MODELS[0]);
  expect(resolveChatModel({ llm: "openai:gpt-5.5" })).toBe(ALLOWED_CHAT_MODELS[0]);
});

test("buildGeminiContents emits text and fileData parts", () => {
  const content = buildGeminiContents("Describe capsule", [{
    uri: "gs://gemini/files/123",
    mimeType: "image/png"
  }]);

  expect(content[0]).toEqual({
    fileData: {
      fileUri: "gs://gemini/files/123",
      mimeType: "image/png"
    }
  });
  expect(content[1]).toEqual({ text: "Describe capsule" });
});

test("buildGeminiSystemInstruction concatenates system and system prompt", () => {
  const userProfile = {
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"]
  };

  expect(buildGeminiSystemInstruction("Be concise", userProfile)).toBe(`Be concise\n\n${buildSystemPrompt(userProfile)}`
  );
});

test("buildGeminiSystemInstruction uses explicit system prompt override", () => {
  expect(buildGeminiSystemInstruction("Be concise", { style: "minimalistic" }, "Override system")).toBe("Be concise\n\nOverride system");
});

test("buildGeminiSystemInstruction returns only system prompt when system is empty", () => {
  const userProfile = { style: "minimalistic" };

  expect(buildGeminiSystemInstruction("", userProfile)).toBe(buildSystemPrompt(userProfile));
});

test("buildGeminiSystemInstruction includes the default system prompt for a neutral profile", () => {
  expect(buildGeminiSystemInstruction("Be concise", {})).toBe(`Be concise\n\n${buildSystemPrompt({})}`
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
  expect(createdCount).toBe(1);
  expect(first).toBe(second);
  expect(first.apiKey).toBe("gem-key");
  expect(first.apiVersion).toBe("v1beta");
  expect(clientInitOptions).toEqual({
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

  expect(result.json).toEqual({ ok: true });
  expect(requestPayload.model).toBe("gemini-2.5-pro");
  expect(requestPayload.config.systemInstruction).toBe(buildSystemPrompt({
      llm: "gemini:gemini-2.5-pro",
      audience: "woman",
      formalityLevel: "formal",
      season: ["winter"]
    }));
  expect(requestPayload.config.responseMimeType).toBe("application/json");
  assertGeminiObjectSchema(requestPayload.config.responseJsonSchema);
  expect(requestPayload.config.responseJsonSchema.type).toBe("object");
  expect(requestPayload.config.responseJsonSchema.properties?.ok.type).toBe("boolean");
  expect(requestPayload.contents[0]).toEqual({
    fileData: {
      fileUri: "gs://gemini/files/1",
      mimeType: "image/png"
    }
  });
  expect(requestPayload.contents[1].text).toBe("Return JSON");
  expect(payloadBuiltCalls).toBe(1);
  expect(images[0].buffer).toBe(null);
  expect(uploadedImages).toEqual([null]);
  expect(deletedImages).toEqual(["files/1"]);

  const missingKeyClient = createGeminiClient({ getApiKeyImpl: () => "" });
  expect(() => missingKeyClient.getGeminiClient()).toThrow(/GEMINI_API_KEY is not set/);
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

  expect(requestPayload.config.systemInstruction).toBe(buildSystemPrompt(userProfile));
  expect(requestPayload.contents[0].text).toBe("Return JSON");
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

  await expect(() => client.generateJsonWithLlm("User: Return JSON")).rejects.toThrow(/Failed to parse JSON response/);
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

  await expect(() => client.generateJsonWithLlm("User: Return JSON", {
      format: {
        ...SIMPLE_OK_FORMAT
      }
    })).rejects.toThrow(/Failed to parse JSON response/);
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

  await expect(() => client.generateJsonWithLlm("User: Return JSON")).rejects.toThrow(/fetch failed/);
});

test("module-level gemini generateJsonWithLlm validates api key", async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  try {
    await expect(() => generateJsonWithLlm("User: Return JSON")).rejects.toThrow(/GEMINI_API_KEY is not set/);
  } finally {
    process.env.GEMINI_API_KEY = originalApiKey;
  }
});
