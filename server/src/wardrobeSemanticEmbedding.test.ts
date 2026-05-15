import { expect, test } from "vitest";
import { buildUploadedWardrobeSemanticSummary } from "./wardrobeSemanticEmbedding.js";

test("buildUploadedWardrobeSemanticSummary matches uploaded wardrobe fields", () => {
  expect(
    buildUploadedWardrobeSemanticSummary({
      name: "Linen shirt",
      description: "Button-front breathable shirt",
      brand: "Studio",
      audience: "all",
      category: "top",
      season: ["summer", "spring"],
      formality_level: ["casual"],
      style: ["minimalistic"],
      occasions: ["office", "travel"],
      color_base: ["white"],
      pattern: "solid",
      composition: "linen, cotton",
      silhouette: "straight",
      fit: "regular",
      closure_type: ["button"],
    }),
  ).toBe(
    [
      "A all white solid top by Studio. Model: Linen shirt. ",
      "Aesthetics & Fit: Designed in a minimalistic style with a straight silhouette and a regular fit. ",
      "Usage: Suitable for casual dress codes. Ideal for office, travel during the summer, spring seasons. ",
      "Materials & Construction: Fastens with a button. Crafted from linen, cotton. ",
      "Key features: Button-front breathable shirt",
    ].join("\n"),
  );
});

test("buildUploadedWardrobeSemanticSummary applies extractor defaults", () => {
  expect(buildUploadedWardrobeSemanticSummary({})).toBe(
    [
      "A unisex solid item by Unknown brand. Model: Unknown model. ",
      "Aesthetics & Fit: Designed in a modern style with a standard silhouette. ",
      "Usage: Suitable for general dress codes. Ideal for everyday use during the all seasons seasons. ",
      "Materials & Construction: Crafted from . ",
      "Key features:",
    ].join("\n"),
  );
});
