import { test, expect } from "vitest";
import {
  buildGeminiImagePromptParts,
  createGeminiImageClient,
  extractGeneratedImage
} from "./geminiImage.js";

test("buildGeminiImagePromptParts creates text and inlineData parts", () => {
  expect(buildGeminiImagePromptParts("draw outfit", [{
      mimeType: "image/png",
      buffer: Buffer.from("img")
    }])).toEqual([
      { text: "draw outfit" },
      {
        inlineData: {
          mimeType: "image/png",
          data: Buffer.from("img").toString("base64")
        }
      }
    ]);
});

test("buildGeminiImagePromptParts skips blank text and missing image buffers", () => {
  expect(buildGeminiImagePromptParts(" ", [
      { mimeType: "image/png", buffer: Buffer.alloc(0) },
      { buffer: Buffer.from("img") }
    ])).toEqual([{
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from("img").toString("base64")
      }
    }]);
});

test("extractGeneratedImage reads interactions image output", () => {
  expect(extractGeneratedImage({
      outputs: [{
        type: "image",
        data: "abc123",
        mime_type: "image/png"
      }]
    })).toEqual({
      base64: "abc123",
      mimeType: "image/png"
    });
});

test("extractGeneratedImage falls back to inlineData candidate parts", () => {
  expect(extractGeneratedImage({
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
    })).toEqual({
      base64: "xyz789",
      mimeType: "image/jpeg"
    });
});

test("extractGeneratedImage supports inline_data and generatedImages response shapes", () => {
  expect(extractGeneratedImage({
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
    })).toEqual({
      base64: "snake-case",
      mimeType: "image/webp"
    });

  expect(extractGeneratedImage({
      generatedImages: [{
        image: {
          imageBytes: "generated",
          mimeType: "image/jpeg"
        }
      }]
    })).toEqual({
      base64: "generated",
      mimeType: "image/jpeg"
    });
});

test("extractGeneratedImage throws when no image is present", () => {
  expect(() => extractGeneratedImage({ outputs: [{ type: "text", data: "nope" }] })).toThrow(/gemini_image_missing_output/);
});

test("gemini image client builds interactions payload and returns base64 image", async () => {
  let requestPayload = null;
  const client = createGeminiImageClient({
    getApiKeyImpl: () => "gem-key",
    createClientImpl: ({ apiKey, apiVersion }) => {
      expect(apiKey).toBe("gem-key");
      expect(apiVersion).toBe("v1beta");
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

  expect(requestPayload.model).toBe("gemini-3.1-flash-image-preview");
  expect(requestPayload.contents).toEqual([
    { text: "draw outfit" },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from("photo").toString("base64")
      }
    }
  ]);
  expect(requestPayload.config).toEqual({
    responseModalities: ["IMAGE"]
  });
  expect(result.image).toEqual({
    base64: "image-base64",
    mimeType: "image/png"
  });
});

test("gemini image client validates api key, caches client, and exposes payload hook", async () => {
  expect(() => createGeminiImageClient({ getApiKeyImpl: () => "" }).getGeminiImageClient()).toThrow(/GEMINI_API_KEY is not set/);

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

  expect(client.getGeminiImageClient()).toBe(client.getGeminiImageClient());
  const result = await client.generateImageWithGemini("", {
    onPayloadBuilt: (payload) => {
      payload.model = "hooked-model";
    }
  });

  expect(createCalls).toBe(1);
  expect(payloads[0].model).toBe("hooked-model");
  expect(payloads[0].contents).toEqual([]);
  expect(result.image.base64).toBe("generated");
});
