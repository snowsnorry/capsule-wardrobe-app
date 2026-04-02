import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_CHAT_MODELS,
  buildGeminiContents,
  cleanupUploadedGeminiFiles,
  createGeminiClient,
  generateJsonWithLlm,
  isRetryableGeminiTransportError,
  resolveChatModel,
  uploadBufferToGemini
} from "./ai/gemini.js";

test("resolveChatModel keeps only supported gemini profile models", () => {
  assert.equal(resolveChatModel({ llm: "gemini:gemini-2.5-pro" }), "gemini-2.5-pro");
  assert.equal(resolveChatModel({ llm: "gemini:unknown-model" }), ALLOWED_CHAT_MODELS[0]);
  assert.equal(resolveChatModel({ llm: "openai:gpt-5.2" }), ALLOWED_CHAT_MODELS[0]);
});

test("buildGeminiContents emits text and fileData parts", () => {
  const content = buildGeminiContents("Describe capsule", [{
    uri: "gs://gemini/files/123",
    mimeType: "image/png"
  }]);

  assert.deepEqual(content[0], { text: "Describe capsule" });
  assert.deepEqual(content[1], {
    fileData: {
      fileUri: "gs://gemini/files/123",
      mimeType: "image/png"
    }
  });
});

test("uploadBufferToGemini writes temp file, uploads it, and deletes local temp file", async () => {
  const calls = [];
  const uploaded = await uploadBufferToGemini({
    files: {
      upload: async (payload) => {
        calls.push(["upload", payload]);
        return { name: "files/123", uri: "gs://gemini/files/123", mimeType: "image/png" };
      }
    }
  }, {
    filename: "capsule.png",
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }, {
    writeFileSyncImpl: (filePath, buffer) => calls.push(["write", filePath, buffer.toString("utf8")]),
    unlinkSyncImpl: (filePath) => calls.push(["unlink", filePath]),
    tmpdirImpl: () => "/tmp/gemini-tests",
    joinImpl: (...parts) => parts.join("/"),
    randomUUIDImpl: () => "uuid-1"
  });

  assert.deepEqual(uploaded, { name: "files/123", uri: "gs://gemini/files/123", mimeType: "image/png" });
  assert.deepEqual(calls, [
    ["write", "/tmp/gemini-tests/uuid-1.png", "image-one"],
    ["upload", {
      file: "/tmp/gemini-tests/uuid-1.png",
      config: {
        mimeType: "image/png",
        displayName: "capsule.png"
      }
    }],
    ["unlink", "/tmp/gemini-tests/uuid-1.png"]
  ]);
});

test("cleanupUploadedGeminiFiles deletes uploaded files and ignores nameless entries", async () => {
  const deleted = [];
  await cleanupUploadedGeminiFiles({
    files: {
      delete: async ({ name }) => {
        deleted.push(name);
      }
    }
  }, [
    { name: "files/123" },
    { uri: "gs://gemini/files/without-name" },
    { name: "files/456" }
  ]);

  assert.deepEqual(deleted, ["files/123", "files/456"]);
});

test("gemini client validates api key and shapes multimodal JSON request", async () => {
  let createdCount = 0;
  let requestPayload = null;
  const uploadedImages = [];
  const deletedImages = [];
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: ({ apiKey, apiVersion }) => {
      createdCount += 1;
      return {
        apiKey,
        apiVersion,
        models: {
          generateContent: async (payload) => {
            requestPayload = payload;
            return { text: "noise before {\"ok\":true} trailing" };
          }
        },
        files: {
          delete: async ({ name }) => {
            deletedImages.push(name);
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

  const images = [{
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }];
  let payloadBuiltCalls = 0;
  const result = await client.generateJsonWithLlm("System: Be concise\nUser: Return JSON", {
    userProfile: { llm: "gemini:gemini-2.5-pro" },
    images,
    onPayloadBuilt: () => {
      payloadBuiltCalls += 1;
    }
  });

  assert.deepEqual(result.json, { ok: true });
  assert.equal(requestPayload.model, "gemini-2.5-pro");
  assert.equal(requestPayload.config.systemInstruction, "Be concise");
  assert.equal(requestPayload.config.responseMimeType, "application/json");
  assert.equal(requestPayload.contents[0].text, "Return JSON");
  assert.deepEqual(requestPayload.contents[1], {
    fileData: {
      fileUri: "gs://gemini/files/1",
      mimeType: "image/png"
    }
  });
  assert.equal(payloadBuiltCalls, 1);
  assert.equal(images[0].buffer, null);
  assert.deepEqual(uploadedImages, [null]);
  assert.deepEqual(deletedImages, ["files/1"]);

  const missingKeyClient = createGeminiClient({ getApiKeyImpl: () => "" });
  assert.throws(() => missingKeyClient.getGeminiClient(), /GEMINI_API_KEY is not set/);
});

test("gemini generateJsonWithLlm throws for invalid JSON", async () => {
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: () => ({
      models: {
        generateContent: async () => ({ text: "not-json" })
      }
    })
  });

  await assert.rejects(
    () => client.generateJsonWithLlm("User: Return JSON"),
    /Failed to parse JSON response/
  );
});

test("gemini retries transient transport failures", async () => {
  let calls = 0;
  const client = createGeminiClient({
    getApiKeyImpl: () => "gem-key",
    waitImpl: async () => {},
    createClientImpl: () => ({
      models: {
        generateContent: async () => {
          calls += 1;
          if (calls < 3) {
            const error = new TypeError("fetch failed");
            error.cause = { code: "UND_ERR_SOCKET" };
            throw error;
          }
          return { text: "{\"ok\":true}" };
        }
      }
    })
  });

  const result = await client.generateJsonWithLlm("User: Return JSON");
  assert.deepEqual(result.json, { ok: true });
  assert.equal(calls, 3);
  assert.equal(isRetryableGeminiTransportError(Object.assign(new TypeError("fetch failed"), {
    cause: { code: "UND_ERR_SOCKET" }
  })), true);
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
