import { test, expect } from "vitest";
import {
  buildCapsuleSchema,
  buildSystemPrompt,
  renderStyleLibraryContent,
} from "./llmPrompts.js";
import { getCapsuleCategories } from "./categories.js";

test("buildCapsuleSchema reflects the default capsule counts", () => {
  const schema = buildCapsuleSchema(getCapsuleCategories());

  expect(schema.required).toEqual([
    "bottom",
    "top",
    "outerwear",
    "shoes",
    "belt",
    "bag",
  ]);
  expect(schema.properties.bottom.minItems).toBe(3);
  expect(schema.properties.top.maxItems).toBe(3);
  expect(schema.properties.outerwear.maxItems).toBe(1);
});

test("buildCapsuleSchema reflects dynamic categories for women in spring and summer", () => {
  const schema = buildCapsuleSchema(
    getCapsuleCategories({ audience: "woman", season: ["spring", "summer"] }),
  );

  expect(schema.required).toEqual([
    "bottom",
    "top",
    "outerwear",
    "shoes",
    "belt",
    "bag",
    "dress",
    "midlayer",
  ]);
  expect(schema.properties.dress.minItems).toBe(2);
  expect(schema.properties.dress.maxItems).toBe(2);
  expect(schema.properties.midlayer.minItems).toBe(2);
  expect(schema.properties.outerwear.minItems).toBe(2);
});

test("buildSystemPrompt renders an alternate template with shared placeholder blocks", () => {
  const prompt = buildSystemPrompt(
    {
      audience: "woman",
      formalityLevel: "formal",
      season: ["winter"],
      style: "minimalistic",
      color: "red",
    },
    {
      template: [
        "ALT PROMPT",
        "{{audience_logic_block}}",
        "{{formality_logic_block}}",
        "{{seasonality_logic_block}}",
        "{{style_library_block}}",
        "{{style_palette_block}}",
        "{{accent_color_palette_block}}",
      ].join("\n\n"),
    },
  );

  expect(prompt).toMatch(/ALT PROMPT/);
  expect(prompt).toMatch(/- woman:/);
  expect(prompt).toMatch(/- formal:/);
  expect(prompt).toMatch(/- winter:/);
  expect(prompt).toMatch(/STYLE LIBRARY/);
  expect(prompt).toMatch(/PALETTE REFERENCE BY STYLE/);
  expect(prompt).toMatch(/PALETTE REFERENCE BY ACCENT COLOR/);
  expect(prompt).not.toMatch(/\{\{/);
});

test("buildSystemPrompt returns the base template without dynamic sections by default", () => {
  const prompt = buildSystemPrompt({});

  expect(prompt).toMatch(/CORE CONSTRAINTS/);
  expect(prompt).toMatch(/AUDIENCE LOGIC/);
  expect(prompt).toMatch(/FORMALITY LOGIC/);
  expect(prompt).toMatch(/SEASONALITY AND LAYERING/);
  expect(prompt).toMatch(
    /- not important: Activate relaxed-fit \/ unisex logic/,
  );
  expect(prompt).toMatch(
    /- Specifics: Linen for summer\/safari; silk for romantic\/formal; heavy wool for winter\./,
  );
  expect(prompt).not.toMatch(/- casual:/);
  expect(prompt).not.toMatch(/- summer:/);
  expect(prompt).not.toMatch(/STYLE LIBRARY/);
  expect(prompt).not.toMatch(/PALETTE REFERENCE BY STYLE/);
  expect(prompt).not.toMatch(/PALETTE REFERENCE BY ACCENT COLOR/);
  expect(prompt).not.toMatch(/\{\{/);
});

test("buildSystemPrompt includes style-specific sections when style is provided", () => {
  const prompt = buildSystemPrompt({
    style: "minimalistic",
    audience: "woman",
    formalityLevel: "smart_casual",
    occasions: ["everyday_errands"],
  });

  expect(prompt).toMatch(/STYLE LIBRARY/);
  expect(prompt).toMatch(/Minimalistic/);
  expect(prompt).toMatch(
    /- Audience: - woman: silk slip midi skirts, crisp poplin button-downs/,
  );
  expect(prompt).toMatch(
    /- Formality Scaling: - smart_casual: black turtlenecks, crisp shirts, classic blazers, sleek loafers/,
  );
  expect(prompt).toMatch(
    /- Occasion Adaptation: - everyday_errands: elevated basics \(white tee, straight jeans\), structured oversized wool coat/,
  );
  expect(prompt).toMatch(/PALETTE REFERENCE BY STYLE/);
  expect(prompt).not.toMatch(/PALETTE REFERENCE BY ACCENT COLOR/);
});

test("buildSystemPrompt injects audience, formality, and selected seasons", () => {
  const prompt = buildSystemPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["spring", "winter"],
  });

  expect(prompt).toMatch(
    /- woman: Allow diverse silhouettes based on Yin\/Yang balance, including A-line, fitted, flowing, waist-accentuating items, skirts, dresses, and delicate detailing/,
  );
  expect(prompt).toMatch(/- formal: Enforce strict dress-code\./);
  expect(prompt).toMatch(
    /- spring\/autumn: Light-to-medium layering; transitional outerwear \(trench coats, light leather, denim jackets\) preferred\./,
  );
  expect(prompt).toMatch(
    /- winter: Insulating layers and thermal logic required\./,
  );
  expect(prompt).not.toMatch(
    /- summer: Lightweight, breathable fabrics; suppress heavy midlayers\./,
  );
});

test("buildSystemPrompt includes spring/autumn line when autumn is selected", () => {
  const prompt = buildSystemPrompt({
    season: ["autumn"],
  });

  expect(prompt).toMatch(
    /- spring\/autumn: Light-to-medium layering; transitional outerwear \(trench coats, light leather, denim jackets\) preferred\./,
  );
  expect(prompt).not.toMatch(
    /- summer: Lightweight, breathable fabrics; suppress heavy midlayers\./,
  );
  expect(prompt).not.toMatch(
    /- winter: Insulating layers, heavy wool, and thermal logic required\./,
  );
});

test("buildSystemPrompt includes accent color defaults when color is provided", () => {
  const prompt = buildSystemPrompt({ color: "red" });

  expect(prompt).toMatch(/PALETTE REFERENCE BY ACCENT COLOR/);
  expect(prompt).toMatch(
    /Riviera Standard: 60% navy \/ 30% white \/ 10% true red or cherry/,
  );
  expect(prompt).not.toMatch(/STYLE LIBRARY/);
});

test("buildSystemPrompt combines style and accent color sections", () => {
  const prompt = buildSystemPrompt({
    style: "minimalistic",
    color: "red",
    audience: "man",
    formalityLevel: "formal",
    occasions: ["office"],
  });

  expect(prompt).toMatch(/STYLE LIBRARY/);
  expect(prompt).toMatch(/PALETTE REFERENCE BY STYLE/);
  expect(prompt).toMatch(/PALETTE REFERENCE BY ACCENT COLOR/);
  expect(prompt).not.toMatch(/\{\{/);
});

test("renderStyleLibraryContent injects only the requested fields and joins occasions with newlines", () => {
  const content = renderStyleLibraryContent(
    {
      template:
        "Minimalistic\n{{audience}}\nFormality:\n{{formality_level}}\nOccasions:\n{{occasions}}",
      audience: {
        woman: "- woman: silk midi skirts, crisp button-downs",
        man: "- man: fine-gauge knits, unstructured blazers",
        "not important":
          "- not important: boxy architectural silhouettes, drop-shoulder tees",
      },
      formality_level: {
        casual: "- casual: heavyweight tees, raw denim",
        smart_casual:
          "- smart_casual: turtlenecks, poplin shirts, sleek loafers",
        formal: "- formal: monochromatic suits, hidden plackets",
      },
      occasions: {
        office: "- office: tailored separates in navy, grey, muted neutrals",
        brunch_in_the_city:
          "- brunch_in_the_city: cashmere sweater + relaxed trousers",
      },
    },
    {
      audience: "any",
      formalityLevel: "smart_casual",
      occasions: ["office", "brunch_in_the_city"],
    },
  );

  expect(content).toMatch(
    /- not important: boxy architectural silhouettes, drop-shoulder tees/,
  );
  expect(content).toMatch(
    /- smart_casual: turtlenecks, poplin shirts, sleek loafers/,
  );
  expect(content).toMatch(
    /- office: tailored separates in navy, grey, muted neutrals\n- brunch_in_the_city: cashmere sweater \+ relaxed trousers/,
  );
  expect(content).not.toMatch(/\{\{/);
});

test("buildSystemPrompt includes retro sections when retro is configured", () => {
  const prompt = buildSystemPrompt({
    style: "retro",
    audience: "woman",
    formalityLevel: "casual",
    occasions: ["date_night"],
  });

  expect(prompt).toMatch(/STYLE LIBRARY/);
  expect(prompt).toMatch(/Retro/);
  expect(prompt).toMatch(/PALETTE REFERENCE BY STYLE/);
});
