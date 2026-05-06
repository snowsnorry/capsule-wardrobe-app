import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCapsuleSchema,
  buildSystemPrompt,
  renderStyleLibraryContent
} from "./llmPrompts.js";
import { getCapsuleCategories } from "./categories.js";

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

test("buildSystemPrompt renders an alternate template with shared placeholder blocks", () => {
  const prompt = buildSystemPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"],
    style: "minimalistic",
    color: "red"
  }, {
    template: [
      "ALT PROMPT",
      "{{audience_logic_block}}",
      "{{formality_logic_block}}",
      "{{seasonality_logic_block}}",
      "{{style_library_block}}",
      "{{style_palette_block}}",
      "{{accent_color_palette_block}}"
    ].join("\n\n")
  });

  assert.match(prompt, /ALT PROMPT/);
  assert.match(prompt, /- woman:/);
  assert.match(prompt, /- formal:/);
  assert.match(prompt, /- winter:/);
  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
  assert.match(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.doesNotMatch(prompt, /\{\{/);
});

test("buildSystemPrompt returns the base template without dynamic sections by default", () => {
  const prompt = buildSystemPrompt({});

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

test("buildSystemPrompt includes style-specific sections when style is provided", () => {
  const prompt = buildSystemPrompt({
    style: "minimalistic",
    audience: "woman",
    formalityLevel: "smart_casual",
    occasions: ["everyday_errands"]
  });

  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /Minimalistic/);
  assert.match(prompt, /- Audience: - woman: silk slip midi skirts, crisp poplin button-downs/);
  assert.match(prompt, /- Formality Scaling: - smart_casual: black turtlenecks, crisp shirts, classic blazers, sleek loafers/);
  assert.match(prompt, /- Occasion Adaptation: - everyday_errands: elevated basics \(white tee, straight jeans\), structured oversized wool coat/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
  assert.doesNotMatch(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
});

test("buildSystemPrompt injects audience, formality, and selected seasons", () => {
  const prompt = buildSystemPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["spring", "winter"]
  });

  assert.match(prompt, /- woman: Allow diverse silhouettes based on Yin\/Yang balance, including A-line, fitted, flowing, waist-accentuating items, skirts, dresses, and delicate detailing/);
  assert.match(prompt, /- formal: Enforce strict dress-code\./);
  assert.match(prompt, /- spring\/autumn: Light-to-medium layering; transitional outerwear \(trench coats, light leather, denim jackets\) preferred\./);
  assert.match(prompt, /- winter: Insulating layers and thermal logic required\./);
  assert.doesNotMatch(prompt, /- summer: Lightweight, breathable fabrics; suppress heavy midlayers\./);
});

test("buildSystemPrompt includes spring/autumn line when autumn is selected", () => {
  const prompt = buildSystemPrompt({
    season: ["autumn"]
  });

  assert.match(prompt, /- spring\/autumn: Light-to-medium layering; transitional outerwear \(trench coats, light leather, denim jackets\) preferred\./);
  assert.doesNotMatch(prompt, /- summer: Lightweight, breathable fabrics; suppress heavy midlayers\./);
  assert.doesNotMatch(prompt, /- winter: Insulating layers, heavy wool, and thermal logic required\./);
});

test("buildSystemPrompt includes accent color defaults when color is provided", () => {
  const prompt = buildSystemPrompt({ color: "red" });

  assert.match(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.match(prompt, /Riviera Standard: 60% navy \/ 30% white \/ 10% true red or cherry/);
  assert.doesNotMatch(prompt, /STYLE LIBRARY/);
});

test("buildSystemPrompt combines style and accent color sections", () => {
  const prompt = buildSystemPrompt({
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

test("buildSystemPrompt includes retro sections when retro is configured", () => {
  const prompt = buildSystemPrompt({
    style: "retro",
    audience: "woman",
    formalityLevel: "casual",
    occasions: ["date_night"]
  });

  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /Retro/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
});
