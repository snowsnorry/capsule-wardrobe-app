import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGeminiImagePromptParts,
  createGeminiImageClient,
  extractGeneratedImage
} from "./geminiImage.js";

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

test("buildGeminiImagePromptParts skips blank text and missing image buffers", () => {
  assert.deepEqual(
    buildGeminiImagePromptParts(" ", [
      { mimeType: "image/png", buffer: Buffer.alloc(0) },
      { buffer: Buffer.from("img") }
    ]),
    [{
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from("img").toString("base64")
      }
    }]
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

test("extractGeneratedImage supports inline_data and generatedImages response shapes", () => {
  assert.deepEqual(
    extractGeneratedImage({
      candidates: [{
        content: {
          parts: [{
            inline_data: {
              data: "snake-case",
              mime_type: "image/webp"
            }
          }]
        }
      }]
    }),
    {
      base64: "snake-case",
      mimeType: "image/webp"
    }
  );

  assert.deepEqual(
    extractGeneratedImage({
      generatedImages: [{
        image: {
          imageBytes: "generated",
          mimeType: "image/jpeg"
        }
      }]
    }),
    {
      base64: "generated",
      mimeType: "image/jpeg"
    }
  );
});

test("extractGeneratedImage throws when no image is present", () => {
  assert.throws(
    () => extractGeneratedImage({ outputs: [{ type: "text", data: "nope" }] }),
    /gemini_image_missing_output/
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

test("gemini image client validates api key, caches client, and exposes payload hook", async () => {
  assert.throws(
    () => createGeminiImageClient({ getApiKeyImpl: () => "" }).getGeminiImageClient(),
    /GEMINI_API_KEY is not set/
  );

  let createCalls = 0;
  const payloads = [];
  const client = createGeminiImageClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: () => {
      createCalls += 1;
      return {
        models: {
          generateContent: async (payload) => {
            payloads.push(payload);
            return {
              generatedImages: [{
                image: {
                  imageBytes: "generated",
                  mimeType: "image/png"
                }
              }]
            };
          }
        }
      };
    }
  });

  assert.equal(client.getGeminiImageClient(), client.getGeminiImageClient());
  const result = await client.generateImageWithGemini("", {
    onPayloadBuilt: (payload) => {
      payload.model = "hooked-model";
    }
  });

  assert.equal(createCalls, 1);
  assert.equal(payloads[0].model, "hooked-model");
  assert.deepEqual(payloads[0].contents, []);
  assert.equal(result.image.base64, "generated");
});
