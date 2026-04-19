import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCapsuleSchema,
  buildDeveloperPrompt,
  buildImageDataUrl,
  buildResponsesInput,
  buildResponsesPayload,
  renderStyleLibraryContent
} from "./ai/openai.js";
import { getCapsuleCategories } from "./ai/categories.js";
import { deserializePromptDebugImagesFromIpc } from "./ai/promptImages.js";

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
  assertResponsesUserContent(input[0].content);
  assert.equal(input[0].content[0].type, "input_image");
  assert.equal(input[0].content[1].type, "input_image");
  assert.equal(input[0].content[2].type, "input_text");
  assert.match(input[0].content[0].image_url, /^data:image\/png;base64,/);
  assert.equal(input[0].content[0].detail, "high");
  assert.equal(input[0].content[2].text, "describe this");
});

test("buildResponsesInput prepends a developer message when provided", () => {
  const input = buildResponsesInput("describe this", [
    {
      mimeType: "image/png",
      buffer: Buffer.from("image-one")
    }
  ], "developer rules");

  assert.ok(Array.isArray(input));
  assert.equal(input[0].role, "developer");
  assert.equal(input[0].content, "developer rules");
  assert.equal(input[1].role, "user");
  assertResponsesUserContent(input[1].content);
  assert.equal(input[1].content[0].type, "input_image");
  assert.equal(input[1].content[1].type, "input_text");
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

test("buildDeveloperPrompt returns the base template without dynamic sections by default", () => {
  const prompt = buildDeveloperPrompt({});

  assert.match(prompt, /CORE CONSTRAINTS/);
  assert.match(prompt, /AUDIENCE LOGIC/);
  assert.match(prompt, /FORMALITY LOGIC/);
  assert.match(prompt, /SEASONALITY AND LAYERING/);
  assert.match(prompt, /- not important: Activate relaxed-fit \/ unisex logic/);
  assert.match(prompt, /- Specifics: Linen for summer\/safari; silk for romantic\/formal; heavy wool for winter\./);
  assert.doesNotMatch(prompt, /- casual:/);
  assert.doesNotMatch(prompt, /- summer:/);
  assert.doesNotMatch(prompt, /STYLE LIBRARY/);
  assert.doesNotMatch(prompt, /PALETTE REFERENCE BY STYLE/);
  assert.doesNotMatch(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.doesNotMatch(prompt, /\{\{/);
});

test("buildDeveloperPrompt includes style-specific sections when style is provided", () => {
  const prompt = buildDeveloperPrompt({
    style: "minimalistic",
    audience: "woman",
    formalityLevel: "smart_casual",
    occasions: ["everyday_errands"]
  });

  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /Minimalistic/);
  assert.match(prompt, /- woman: silk midi skirts, crisp button-downs/);
  assert.match(prompt, /- smart_casual: turtlenecks, poplin shirts, sleek loafers/);
  assert.match(prompt, /- Occasion Adaptation: - everyday_errands: elevated basics, oversized wool coat/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
  assert.doesNotMatch(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
});

test("buildDeveloperPrompt injects audience, formality, and selected seasons", () => {
  const prompt = buildDeveloperPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["spring", "winter"]
  });

  assert.match(prompt, /- woman: Allow diverse silhouettes including A-line, fitted, flowing, waist-accentuating items, skirts, dresses, and delicate detailing\./);
  assert.match(prompt, /- formal: Enforce strict dress-code\./);
  assert.match(prompt, /- spring\/autumn: Light-to-medium layering; transitional outerwear preferred\./);
  assert.match(prompt, /- winter: Insulating layers, heavy wool, and thermal logic required\./);
  assert.doesNotMatch(prompt, /- summer: Lightweight, breathable fabrics; suppress heavy midlayers\./);
});

test("buildDeveloperPrompt includes spring/autumn line when autumn is selected", () => {
  const prompt = buildDeveloperPrompt({
    season: ["autumn"]
  });

  assert.match(prompt, /- spring\/autumn: Light-to-medium layering; transitional outerwear preferred\./);
  assert.doesNotMatch(prompt, /- summer: Lightweight, breathable fabrics; suppress heavy midlayers\./);
  assert.doesNotMatch(prompt, /- winter: Insulating layers, heavy wool, and thermal logic required\./);
});

test("buildDeveloperPrompt includes accent color defaults when color is provided", () => {
  const prompt = buildDeveloperPrompt({ color: "red" });

  assert.match(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.match(prompt, /Option 1: 60% navy \/ 30% white \/ 10% red/);
  assert.doesNotMatch(prompt, /STYLE LIBRARY/);
});

test("buildDeveloperPrompt combines style and accent color sections", () => {
  const prompt = buildDeveloperPrompt({
    style: "minimalistic",
    color: "red",
    audience: "man",
    formalityLevel: "formal",
    occasions: ["office"]
  });

  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
  assert.match(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.doesNotMatch(prompt, /\{\{/);
});

test("renderStyleLibraryContent injects only the requested fields and joins occasions with newlines", () => {
  const content = renderStyleLibraryContent({
    template: "Minimalistic\n{{audience}}\nFormality:\n{{formality_level}}\nOccasions:\n{{occasions}}",
    audience: {
      woman: "- woman: silk midi skirts, crisp button-downs",
      man: "- man: fine-gauge knits, unstructured blazers",
      "not important": "- not important: boxy architectural silhouettes, drop-shoulder tees"
    },
    formality_level: {
      casual: "- casual: heavyweight tees, raw denim",
      smart_casual: "- smart_casual: turtlenecks, poplin shirts, sleek loafers",
      formal: "- formal: monochromatic suits, hidden plackets"
    },
    occasions: {
      office: "- office: tailored separates in navy, grey, muted neutrals",
      brunch_in_the_city: "- brunch_in_the_city: cashmere sweater + relaxed trousers"
    }
  }, {
    audience: "any",
    formalityLevel: "smart_casual",
    occasions: ["office", "brunch_in_the_city"]
  });

  assert.match(content, /- not important: boxy architectural silhouettes, drop-shoulder tees/);
  assert.match(content, /- smart_casual: turtlenecks, poplin shirts, sleek loafers/);
  assert.match(content, /- office: tailored separates in navy, grey, muted neutrals\n- brunch_in_the_city: cashmere sweater \+ relaxed trousers/);
  assert.doesNotMatch(content, /\{\{/);
});

test("buildDeveloperPrompt includes retro sections when retro is configured", () => {
  const prompt = buildDeveloperPrompt({
    style: "retro",
    audience: "woman",
    formalityLevel: "casual",
    occasions: ["date_night"]
  });

  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /Retro/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
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
