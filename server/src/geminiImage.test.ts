import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGeminiImagePromptParts,
  createGeminiImageClient,
  extractGeneratedImage
} from "./ai/geminiImage.js";

test("buildGeminiImagePromptParts creates text and inlineData parts", () => {
  assert.deepEqual(
    buildGeminiImagePromptParts("draw outfit", [{
      mimeType: "image/png",
      buffer: Buffer.from("img")
    }]),
    [
      { text: "draw outfit" },
      {
        inlineData: {
          mimeType: "image/png",
          data: Buffer.from("img").toString("base64")
        }
      }
    ]
  );
});

test("extractGeneratedImage reads interactions image output", () => {
  assert.deepEqual(
    extractGeneratedImage({
      outputs: [{
        type: "image",
        data: "abc123",
        mime_type: "image/png"
      }]
    }),
    {
      base64: "abc123",
      mimeType: "image/png"
    }
  );
});

test("extractGeneratedImage falls back to inlineData candidate parts", () => {
  assert.deepEqual(
    extractGeneratedImage({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              data: "xyz789",
              mimeType: "image/jpeg"
            }
          }]
        }
      }]
    }),
    {
      base64: "xyz789",
      mimeType: "image/jpeg"
    }
  );
});

test("gemini image client builds interactions payload and returns base64 image", async () => {
  let requestPayload = null;
  const client = createGeminiImageClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: ({ apiKey, apiVersion }) => {
      assert.equal(apiKey, "gem-key");
      assert.equal(apiVersion, "v1beta");
      return {
        models: {
          generateContent: async (payload) => {
            requestPayload = payload;
            return {
              outputs: [],
              candidates: [{
                content: {
                  parts: [{
                    inlineData: {
                      data: "image-base64",
                      mimeType: "image/png"
                    }
                  }]
                }
              }]
            };
          }
        }
      };
    }
  });

  const result = await client.generateImageWithGemini("draw outfit", {
    images: [{
      mimeType: "image/jpeg",
      buffer: Buffer.from("photo")
    }],
    model: "gemini-3.1-flash-image-preview"
  });

  assert.equal(requestPayload.model, "gemini-3.1-flash-image-preview");
  assert.deepEqual(requestPayload.contents, [
    { text: "draw outfit" },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from("photo").toString("base64")
      }
    }
  ]);
  assert.deepEqual(requestPayload.config, {
    responseModalities: ["IMAGE"]
  });
  assert.deepEqual(result.image, {
    base64: "image-base64",
    mimeType: "image/png"
  });
});
