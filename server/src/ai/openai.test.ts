import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImageDataUrl,
  buildResponsesInput,
  buildResponsesPayload
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
