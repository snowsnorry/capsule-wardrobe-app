import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenAiImageFiles,
  createOpenAiImageClient,
  extractGeneratedImage
} from "./openaiImage.js";

test("extractGeneratedImage reads base64 image output", () => {
  assert.deepEqual(
    extractGeneratedImage({
      output_format: "webp",
      data: [{
        b64_json: "image-base64"
      }]
    }),
    {
      base64: "image-base64",
      mimeType: "image/webp"
    }
  );
});

test("buildOpenAiImageFiles converts only valid buffers", async () => {
  const files = await buildOpenAiImageFiles([
    {
      filename: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("photo")
    },
    {
      filename: "missing.jpg",
      mimeType: "image/jpeg",
      buffer: null
    }
  ]);

  assert.equal(files.length, 1);
  assert.equal(files[0].name, "photo.png");
  assert.equal(files[0].type, "image/png");
});

test("openai image client uses generate when no reference images are provided", async () => {
  let generatePayload: Record<string, unknown> | null = null;
  let editPayload: Record<string, unknown> | null = null;
  const client = createOpenAiImageClient({
    cache: false,
    getApiKeyImpl: () => "openai-key",
    createClientImpl: ({ apiKey }) => {
      assert.equal(apiKey, "openai-key");
      return {
        images: {
          generate: async (payload) => {
            generatePayload = payload;
            return {
              output_format: "png",
              data: [{ b64_json: "generated-base64" }]
            };
          },
          edit: async (payload) => {
            editPayload = payload;
            throw new Error("unexpected_edit_call");
          }
        }
      };
    }
  });

  const result = await client.generateImageWithOpenAi("draw outfit", {
    model: "gpt-image-2"
  });

  assert.deepEqual(generatePayload, {
    model: "gpt-image-2",
    prompt: "draw outfit",
    n: 1
  });
  assert.equal(editPayload, null);
  assert.deepEqual(result.image, {
    base64: "generated-base64",
    mimeType: "image/png"
  });
});

test("openai image client uses edit when reference images are provided", async () => {
  let generatePayload: Record<string, unknown> | null = null;
  let editPayload: (Record<string, unknown> & { image?: { name?: string }[] }) | null = null;
  const client = createOpenAiImageClient({
    cache: false,
    getApiKeyImpl: () => "openai-key",
    createClientImpl: () => ({
      images: {
        generate: async (payload) => {
          generatePayload = payload;
          throw new Error("unexpected_generate_call");
        },
        edit: async (payload) => {
          editPayload = payload;
          return {
            output_format: "jpeg",
            data: [{ b64_json: "edited-base64" }]
          };
        }
      }
    })
  });

  const result = await client.generateImageWithOpenAi("edit outfit", {
    model: "gpt-image-2",
    images: [{
      filename: "top.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("top")
    }]
  });

  assert.equal(generatePayload, null);
  assert.ok(editPayload);
  assert.equal(editPayload.model, "gpt-image-2");
  assert.equal(editPayload.prompt, "edit outfit");
  assert.equal(editPayload.n, 1);
  assert.equal(editPayload.image.length, 1);
  assert.equal(editPayload.image[0].name, "top.jpg");
  assert.deepEqual(result.image, {
    base64: "edited-base64",
    mimeType: "image/jpeg"
  });
});
