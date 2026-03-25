import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCapsuleSchema,
  buildImageDataUrl,
  buildResponsesInput,
  buildResponsesPayload
} from "./ai/openai.js";
import { getCapsuleCategories } from "./ai/categories.js";

test("buildCapsuleSchema reflects the default capsule counts", () => {
  const schema = buildCapsuleSchema(getCapsuleCategories());

  assert.deepEqual(schema.required, ["bottom", "top", "outerwear", "shoes", "belt", "bag"]);
  assert.equal(schema.properties.bottom.minItems, 3);
  assert.equal(schema.properties.top.maxItems, 3);
  assert.equal(schema.properties.outerwear.maxItems, 1);
});

test("buildCapsuleSchema reflects dynamic categories for women in spring and summer", () => {
  const schema = buildCapsuleSchema(getCapsuleCategories({ audience: "woman", season: ["spring", "summer"] }));

  assert.deepEqual(schema.required, [
    "bottom",
    "top",
    "outerwear",
    "shoes",
    "belt",
    "bag",
    "dress",
    "midlayer"
  ]);
  assert.equal(schema.properties.dress.minItems, 2);
  assert.equal(schema.properties.dress.maxItems, 2);
  assert.equal(schema.properties.midlayer.minItems, 2);
  assert.equal(schema.properties.outerwear.minItems, 2);
});

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
  assert.equal(input[0].content[0].type, "input_text");
  assert.equal(input[0].content[1].type, "input_image");
  assert.equal(input[0].content[2].type, "input_image");
  assert.match(input[0].content[1].image_url, /^data:image\/png;base64,/);
  assert.equal(input[0].content[1].detail, "high");
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
  assert.equal(images[0].buffer, null);
  assert.match(input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
});
