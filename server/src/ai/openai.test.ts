import { test, expect, vi } from "vitest";
import {
  buildImageDataUrl,
  buildOpenAiParseError,
  buildOpenAiSystemPrompt,
  buildResponsesInput,
  buildResponsesPayload,
  generateJsonWithLlmWithClient,
  getPromptEmbeddingsWithClient,
  parseOpenAiJsonResponse,
  releaseImageBuffers,
} from "./openai.js";
import { deserializePromptDebugImagesFromIpc } from "./promptImages.js";

function assertResponsesUserContent(
  content:
    | string
    | Array<
        | { type: "input_image"; image_url: string; detail: "high" }
        | { type: "input_text"; text: string }
      >,
): asserts content is Array<
  | { type: "input_image"; image_url: string; detail: "high" }
  | { type: "input_text"; text: string }
> {
  if (!Array.isArray(content)) {
    throw new Error("Expected responses content array");
  }
}

function assertResponsesInput(
  input: ReturnType<typeof buildResponsesInput>,
): asserts input is Array<{
  role: string;
  content: Array<
    | { type: "input_image"; image_url: string; detail: "high" }
    | { type: "input_text"; text: string }
  >;
}> {
  if (!Array.isArray(input)) {
    throw new Error("Expected responses input array");
  }
}

function assertInputImage(
  part:
    | { type: "input_image"; image_url: string; detail: "high" }
    | { type: "input_text"; text: string },
): asserts part is { type: "input_image"; image_url: string; detail: "high" } {
  expect(part.type).toBe("input_image");
  if (part.type !== "input_image") {
    throw new Error("Expected input_image part");
  }
}

function assertInputText(
  part:
    | { type: "input_image"; image_url: string; detail: "high" }
    | { type: "input_text"; text: string },
): asserts part is { type: "input_text"; text: string } {
  expect(part.type).toBe("input_text");
  if (part.type !== "input_text") {
    throw new Error("Expected input_text part");
  }
}

test("buildImageDataUrl returns a base64 data URL for buffered images", () => {
  const dataUrl = buildImageDataUrl({
    mimeType: "image/png",
    buffer: Buffer.from("hello world"),
  });

  expect(dataUrl).toMatch(/^data:image\/png;base64,/);
});

test("buildResponsesInput keeps text-only payloads as a string", () => {
  expect(buildResponsesInput("hello", [])).toBe("hello");
});

test("buildResponsesInput creates multimodal content with input_text and input_image items", () => {
  const input = buildResponsesInput("describe this", [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one"),
      category: "top",
      filename: "category-top.png",
    },
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-two"),
      category: "bottom",
      filename: "category-bottom.png",
    },
  ]);

  assertResponsesInput(input);
  expect(input[0].role).toBe("user");
  assertResponsesUserContent(input[0].content);
  assertInputImage(input[0].content[0]);
  assertInputImage(input[0].content[1]);
  assertInputText(input[0].content[2]);
  expect(input[0].content[0].image_url).toMatch(/^data:image\/png;base64,/);
  expect(input[0].content[0].detail).toBe("high");
  expect(input[0].content[2].text).toBe("describe this");
});

test("buildResponsesInput keeps multimodal payloads user-only", () => {
  const input = buildResponsesInput("describe this", [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one"),
    },
  ]);

  assertResponsesInput(input);
  expect(input.length).toBe(1);
  expect(input[0].role).toBe("user");
  assertResponsesUserContent(input[0].content);
  assertInputImage(input[0].content[0]);
  assertInputText(input[0].content[1]);
});

test("buildResponsesPayload releases source image buffers after payload construction", () => {
  const images = [
    {
      mimeType: "image/jpeg",
      buffer: Buffer.from("image-one"),
      category: "top",
    },
  ];

  const input = buildResponsesPayload("describe this", images);

  assertResponsesInput(input);
  assertResponsesUserContent(input[0].content);
  expect(images[0].buffer).toBe(null);
  assertInputImage(input[0].content[0]);
  assertInputText(input[0].content[1]);
  expect(input[0].content[0].image_url).toMatch(/^data:image\/jpeg;base64,/);
  expect(input[0].content[1].text).toBe("describe this");
});

test("buildResponsesInput accepts prompt image collages deserialized from IPC payloads", () => {
  const promptImages = deserializePromptDebugImagesFromIpc({
    downloadedCount: 1,
    skippedCount: 0,
    stitched: {
      category: "all-categories",
      mimeType: "image/jpeg",
      filename: "categories-stitched.jpg",
      totalItems: 1,
      categoryCount: 1,
      buffer: Buffer.from("image-one"),
    },
    categories: [
      {
        category: "top",
        mimeType: "image/jpeg",
        filename: "category-top.jpg",
        totalItems: 1,
        downloadedCount: 1,
        skippedCount: 0,
        items: [],
        buffer: Buffer.from("image-one"),
      },
    ],
  });

  const input = buildResponsesInput("describe this", [promptImages.stitched]);

  assertResponsesInput(input);
  assertResponsesUserContent(input[0].content);
  assertInputImage(input[0].content[0]);
  assertInputText(input[0].content[1]);
  expect(input[0].content[0].image_url).toMatch(/^data:image\/jpeg;base64,/);
  expect(input[0].content[1].text).toBe("describe this");
});

test("buildResponsesInput skips invalid image buffers and releaseImageBuffers clears mutable buffers", () => {
  const warnings = [];
  vi.spyOn(console, "warn").mockImplementation((...args) => {
    warnings.push(args);
  });

  const images = [
    {
      mimeType: "image/png",
      buffer: Buffer.alloc(0),
      category: "top",
      filename: "empty.png",
    },
    {
      mimeType: "image/webp",
      buffer: Buffer.from("image"),
    },
  ];

  const input = buildResponsesInput("", images);

  assertResponsesInput(input);
  assertResponsesUserContent(input[0].content);
  expect(input[0].content.length).toBe(1);
  assertInputImage(input[0].content[0]);

  releaseImageBuffers(images);
  expect(images[0].buffer).toBe(null);
  expect(images[1].buffer).toBe(null);
  expect(warnings.length).toBe(1);
  expect(JSON.parse(String(warnings[0][0]))).toMatchObject({
    message: "[openai][image-skipped]",
  });
});

test("OpenAI response helpers build system prompts and parse JSON from noisy output", () => {
  expect(
    buildOpenAiSystemPrompt("System", "Override", { style: "minimalistic" }),
  ).toBe("System\n\nOverride");
  expect(buildOpenAiSystemPrompt("", null, { audience: "woman" })).toMatch(
    /capsule wardrobe generator/i,
  );

  expect(
    parseOpenAiJsonResponse({
      output_text: 'prefix {"ok":true,"items":[1]} suffix',
    }),
  ).toEqual({ ok: true, items: [1] });
});

test("OpenAI parse errors preserve raw non-empty response text", () => {
  try {
    parseOpenAiJsonResponse({ output_text: "not json" });
    throw new Error("Expected parseOpenAiJsonResponse to throw");
  } catch (error) {
    expect((error as Error).message).toMatch(/Failed to parse JSON response/);
    expect(
      (error as Error & { rawSelectionText?: string | null }).rawSelectionText,
    ).toBe("not json");
  }

  const error = buildOpenAiParseError(new Error("bad"), "{", " raw ");
  expect(error.rawSelectionText).toBe("raw");
});

test("OpenAI client helpers shape embedding and response requests", async () => {
  const embeddingCalls = [];
  const responseCalls = [];
  const client = {
    embeddings: {
      create: async (payload) => {
        embeddingCalls.push(payload);
        return { data: [{ embedding: [0.1, 0.2] }] };
      },
    },
    responses: {
      create: async (payload) => {
        responseCalls.push(payload);
        return { output_text: '{"ok":true}', usage: { total_tokens: 3 } };
      },
    },
  };

  expect(await getPromptEmbeddingsWithClient(client, "capsule prompt")).toEqual(
    [0.1, 0.2],
  );
  expect(embeddingCalls[0]).toEqual({
    model: "text-embedding-3-small",
    input: "capsule prompt",
    encoding_format: "float",
  });

  const image = {
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  };
  const result = await generateJsonWithLlmWithClient(
    client,
    "System: Rules\n\nUser: Pick items",
    {
      images: [image],
      format: {
        type: "json_schema",
        name: "test_schema",
        schema: { type: "object", additionalProperties: true },
        strict: true,
      },
      systemPrompt: "Override",
    },
  );

  expect(result.json).toEqual({ ok: true });
  expect(image.buffer).toBe(null);
  expect(responseCalls.length).toBe(1);
  expect(responseCalls[0].model).toBe("gpt-5.5");
  expect(responseCalls[0].instructions).toMatch(/Rules/);
  expect(responseCalls[0].instructions).toMatch(/Override/);
  expect(responseCalls[0].text.format.type).toBe("json_schema");
  expect(Array.isArray(responseCalls[0].input)).toBeTruthy();
});

test("OpenAI client uses the model selected in the profile", async () => {
  const responseCalls = [];
  const client = {
    responses: {
      create: async (payload) => {
        responseCalls.push(payload);
        return { output_text: '{"ok":true}' };
      },
    },
  };

  await generateJsonWithLlmWithClient(client, "Return JSON", {
    userProfile: { llm: "openai:gpt-5.6-terra" },
  });

  expect(responseCalls[0].model).toBe("gpt-5.6-terra");
});

test("OpenAI client helpers reject invalid embeddings and rethrow response failures", async () => {
  await expect(() =>
    getPromptEmbeddingsWithClient(
      {
        embeddings: {
          create: async () => ({ data: [{ embedding: [] }] }),
        },
      },
      "prompt",
    ),
  ).rejects.toThrow(/Failed to compute prompt embeddings/);

  const errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args);
  });

  await expect(() =>
    generateJsonWithLlmWithClient(
      {
        responses: {
          create: async () => {
            throw new Error("transport");
          },
        },
      },
      "User only",
    ),
  ).rejects.toThrow(/transport/);
  expect(errors.length).toBe(1);
  expect(JSON.parse(String(errors[0][0]))).toMatchObject({
    message: "[openai][request-failed]",
    values: [
      "[openai][request-failed]",
      expect.any(String),
      {
        message: "transport",
      },
    ],
  });
});
