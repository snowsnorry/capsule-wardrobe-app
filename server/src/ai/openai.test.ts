import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImageDataUrl,
  buildOpenAiParseError,
  buildOpenAiSystemPrompt,
  buildResponsesInput,
  buildResponsesPayload,
  generateJsonWithLlmWithClient,
  getPromptEmbeddingsWithClient,
  parseOpenAiJsonResponse,
  releaseImageBuffers
} from "./openai.js";
import { deserializePromptDebugImagesFromIpc } from "./promptImages.js";

function assertResponsesUserContent(
  content: string | Array<
    | { type: "input_image"; image_url: string; detail: "high" }
    | { type: "input_text"; text: string }
  >
): asserts content is Array<
  | { type: "input_image"; image_url: string; detail: "high" }
  | { type: "input_text"; text: string }
> {
  assert.ok(Array.isArray(content));
}

test("buildImageDataUrl returns a base64 data URL for buffered images", () => {
  const dataUrl = buildImageDataUrl({
    mimeType: "image/png",
    buffer: Buffer.from("hello world")
  });

  assert.match(dataUrl, /^data:image\/png;base64,/);
});

test("buildResponsesInput keeps text-only payloads as a string", () => {
  assert.equal(buildResponsesInput("hello", []), "hello");
});

test("buildResponsesInput creates multimodal content with input_text and input_image items", () => {
  const input = buildResponsesInput("describe this", [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one"),
      category: "top",
      filename: "category-top.png"
    },
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-two"),
      category: "bottom",
      filename: "category-bottom.png"
    }
  ]);

  assert.ok(Array.isArray(input));
  assert.equal(input[0].role, "user");
  assertResponsesUserContent(input[0].content);
  assert.equal(input[0].content[0].type, "input_image");
  assert.equal(input[0].content[1].type, "input_image");
  assert.equal(input[0].content[2].type, "input_text");
  assert.match(input[0].content[0].image_url, /^data:image\/png;base64,/);
  assert.equal(input[0].content[0].detail, "high");
  assert.equal(input[0].content[2].text, "describe this");
});

test("buildResponsesInput keeps multimodal payloads user-only", () => {
  const input = buildResponsesInput("describe this", [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one")
    }
  ]);

  assert.ok(Array.isArray(input));
  assert.equal(input.length, 1);
  assert.equal(input[0].role, "user");
  assertResponsesUserContent(input[0].content);
  assert.equal(input[0].content[0].type, "input_image");
  assert.equal(input[0].content[1].type, "input_text");
});

test("buildResponsesPayload releases source image buffers after payload construction", () => {
  const images = [
    {
      mimeType: "image/jpeg",
      buffer: Buffer.from("image-one"),
      category: "top"
    }
  ];

  const input = buildResponsesPayload("describe this", images);

  assert.ok(Array.isArray(input));
  assertResponsesUserContent(input[0].content);
  assert.equal(images[0].buffer, null);
  assert.equal(input[0].content[0].type, "input_image");
  assert.equal(input[0].content[1].type, "input_text");
  assert.match(input[0].content[0].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(input[0].content[1].text, "describe this");
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
      buffer: Buffer.from("image-one")
    },
    categories: [{
      category: "top",
      mimeType: "image/jpeg",
      filename: "category-top.jpg",
      totalItems: 1,
      downloadedCount: 1,
      skippedCount: 0,
      items: [],
      buffer: Buffer.from("image-one")
    }]
  });

  const input = buildResponsesInput("describe this", [promptImages.stitched]);

  assert.ok(Array.isArray(input));
  assertResponsesUserContent(input[0].content);
  assert.equal(input[0].content[0].type, "input_image");
  assert.equal(input[0].content[1].type, "input_text");
  assert.match(input[0].content[0].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(input[0].content[1].text, "describe this");
});

test("buildResponsesInput skips invalid image buffers and releaseImageBuffers clears mutable buffers", (t) => {
  const warnings = [];
  t.mock.method(console, "warn", (...args) => {
    warnings.push(args);
  });

  const images = [
    {
      mimeType: "image/png",
      buffer: Buffer.alloc(0),
      category: "top",
      filename: "empty.png"
    },
    {
      mimeType: "image/webp",
      buffer: Buffer.from("image")
    }
  ];

  const input = buildResponsesInput("", images);

  assert.ok(Array.isArray(input));
  assertResponsesUserContent(input[0].content);
  assert.equal(input[0].content.length, 1);
  assert.equal(input[0].content[0].type, "input_image");

  releaseImageBuffers(images);
  assert.equal(images[0].buffer, null);
  assert.equal(images[1].buffer, null);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "[openai][image-skipped]");
});

test("OpenAI response helpers build system prompts and parse JSON from noisy output", () => {
  assert.equal(
    buildOpenAiSystemPrompt("System", "Override", { style: "minimalistic" }),
    "System\n\nOverride"
  );
  assert.match(buildOpenAiSystemPrompt("", null, { audience: "woman" }), /capsule wardrobe generator/i);

  assert.deepEqual(
    parseOpenAiJsonResponse({
      output_text: "prefix {\"ok\":true,\"items\":[1]} suffix"
    }),
    { ok: true, items: [1] }
  );
});

test("OpenAI parse errors preserve raw non-empty response text", () => {
  assert.throws(
    () => parseOpenAiJsonResponse({ output_text: "not json" }),
    (error) => {
      assert.match((error as Error).message, /Failed to parse JSON response/);
      assert.equal((error as Error & { rawSelectionText?: string | null }).rawSelectionText, "not json");
      return true;
    }
  );

  const error = buildOpenAiParseError(new Error("bad"), "{", " raw ");
  assert.equal(error.rawSelectionText, "raw");
});

test("OpenAI client helpers shape embedding and response requests", async () => {
  const embeddingCalls = [];
  const responseCalls = [];
  const client = {
    embeddings: {
      create: async (payload) => {
        embeddingCalls.push(payload);
        return { data: [{ embedding: [0.1, 0.2] }] };
      }
    },
    responses: {
      create: async (payload) => {
        responseCalls.push(payload);
        return { output_text: "{\"ok\":true}", usage: { total_tokens: 3 } };
      }
    }
  };

  assert.deepEqual(await getPromptEmbeddingsWithClient(client, "capsule prompt"), [0.1, 0.2]);
  assert.deepEqual(embeddingCalls[0], {
    model: "text-embedding-3-small",
    input: "capsule prompt",
    encoding_format: "float"
  });

  const image = {
    mimeType: "image/png",
    buffer: Buffer.from("image")
  };
  const result = await generateJsonWithLlmWithClient(client, "System: Rules\n\nUser: Pick items", {
    images: [image],
    format: {
      type: "json_schema",
      name: "test_schema",
      schema: { type: "object", additionalProperties: true },
      strict: true
    },
    systemPrompt: "Override"
  });

  assert.deepEqual(result.json, { ok: true });
  assert.equal(image.buffer, null);
  assert.equal(responseCalls.length, 1);
  assert.equal(responseCalls[0].model, "gpt-5.5");
  assert.match(responseCalls[0].instructions, /Rules/);
  assert.match(responseCalls[0].instructions, /Override/);
  assert.equal(responseCalls[0].text.format.type, "json_schema");
  assert.ok(Array.isArray(responseCalls[0].input));
});

test("OpenAI client helpers reject invalid embeddings and rethrow response failures", async (t) => {
  await assert.rejects(
    () => getPromptEmbeddingsWithClient({
      embeddings: {
        create: async () => ({ data: [{ embedding: [] }] })
      }
    }, "prompt"),
    /Failed to compute prompt embeddings/
  );

  const errors = [];
  t.mock.method(console, "error", (...args) => {
    errors.push(args);
  });

  await assert.rejects(
    () => generateJsonWithLlmWithClient({
      responses: {
        create: async () => {
          throw new Error("transport");
        }
      }
    }, "User only"),
    /transport/
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], "[openai][request-failed]");
});
