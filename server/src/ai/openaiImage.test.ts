import { test, expect } from "vitest";
import {
  buildOpenAiImageFiles,
  createOpenAiImageClient,
  extractGeneratedImage,
} from "./openaiImage.js";
import { muteExpectedStructuredLog } from "../test/structuredLogSpies.js";

test("extractGeneratedImage reads base64 image output", () => {
  expect(
    extractGeneratedImage({
      output_format: "webp",
      data: [
        {
          b64_json: "image-base64",
        },
      ],
    }),
  ).toEqual({
    base64: "image-base64",
    mimeType: "image/webp",
  });
});

test("buildOpenAiImageFiles converts only valid buffers", async (t) => {
  muteExpectedStructuredLog(t, "warn", "ai.openai.image.skipped");

  const files = await buildOpenAiImageFiles([
    {
      filename: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("photo"),
    },
    {
      filename: "missing.jpg",
      mimeType: "image/jpeg",
      buffer: null,
    },
  ]);

  expect(files.length).toBe(1);
  expect(files[0].name).toBe("photo.png");
  expect(files[0].type).toBe("image/png");
});

test("openai image client uses generate when no reference images are provided", async () => {
  let generatePayload: Record<string, unknown> | null = null;
  let editPayload: Record<string, unknown> | null = null;
  const client = createOpenAiImageClient({
    cache: false,
    getApiKeyImpl: () => "openai-key",
    createClientImpl: ({ apiKey }) => {
      expect(apiKey).toBe("openai-key");
      return {
        images: {
          generate: async (payload) => {
            generatePayload = payload;
            return {
              output_format: "png",
              data: [{ b64_json: "generated-base64" }],
            };
          },
          edit: async (payload) => {
            editPayload = payload;
            throw new Error("unexpected_edit_call");
          },
        },
      };
    },
  });

  const result = await client.generateImageWithOpenAi("draw outfit", {
    model: "gpt-image-2",
  });

  expect(generatePayload).toEqual({
    model: "gpt-image-2",
    prompt: "draw outfit",
    n: 1,
  });
  expect(editPayload).toBe(null);
  expect(result.image).toEqual({
    base64: "generated-base64",
    mimeType: "image/png",
  });
});

test("openai image client uses edit when reference images are provided", async () => {
  let generatePayload: Record<string, unknown> | null = null;
  let editPayload:
    (Record<string, unknown> & { image?: { name?: string }[] }) | null = null;
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
            data: [{ b64_json: "edited-base64" }],
          };
        },
      },
    }),
  });

  const result = await client.generateImageWithOpenAi("edit outfit", {
    model: "gpt-image-2",
    images: [
      {
        filename: "top.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("top"),
      },
    ],
  });

  expect(generatePayload).toBe(null);
  expect(editPayload).toBeTruthy();
  expect(editPayload.model).toBe("gpt-image-2");
  expect(editPayload.prompt).toBe("edit outfit");
  expect(editPayload.n).toBe(1);
  expect(editPayload.image.length).toBe(1);
  expect(editPayload.image[0].name).toBe("top.jpg");
  expect(result.image).toEqual({
    base64: "edited-base64",
    mimeType: "image/jpeg",
  });
});
