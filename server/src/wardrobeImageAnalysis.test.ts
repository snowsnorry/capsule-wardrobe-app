import { expect, test, vi } from "vitest";
import {
  analyzeWardrobeImageUrl,
  buildWardrobeImageAnalysisPrompt,
  calculateWardrobeImageIsNeutral,
  hasWardrobeImageAnalysisMetadata,
  normalizeWardrobeImageAnalysisMetadata,
} from "./wardrobeImageAnalysis.js";

test("wardrobe image analysis prompt combines YAML system and user messages", () => {
  const prompt = buildWardrobeImageAnalysisPrompt();

  expect(prompt).toContain("System:");
  expect(prompt).toContain("User:");
  expect(prompt).toContain("expert fashion image attribute extraction");
  expect(prompt).toContain("attached product image");
});

test("wardrobe image analysis normalizes recognized metadata fields", () => {
  const metadata = normalizeWardrobeImageAnalysisMetadata({
    _reasoning: "ignore",
    name: "  Linen shirt  ",
    category: "top",
    season: [" summer ", "", null],
    color_base: ["white"],
    composition: ["linen", "cotton"],
    unknown: "ignored",
  });

  expect(metadata).toEqual(
    expect.objectContaining({
      name: "Linen shirt",
      category: "top",
      season: ["summer"],
      color_base: ["white"],
      is_neutral: null,
      composition: "linen, cotton",
    }),
  );
  expect(hasWardrobeImageAnalysisMetadata(metadata)).toBe(true);
  expect(
    hasWardrobeImageAnalysisMetadata(
      normalizeWardrobeImageAnalysisMetadata({ _reasoning: "empty" }),
    ),
  ).toBe(false);
});

test("wardrobe image analysis calculates neutrality from recognized neutral colors only", () => {
  expect(
    calculateWardrobeImageIsNeutral(
      normalizeWardrobeImageAnalysisMetadata({
        color_base: ["Black", " light blue ", "denim"],
      }),
    ),
  ).toBe(true);
  expect(
    calculateWardrobeImageIsNeutral(
      normalizeWardrobeImageAnalysisMetadata({ color_base: ["black", "red"] }),
    ),
  ).toBe(false);
  expect(
    calculateWardrobeImageIsNeutral(
      normalizeWardrobeImageAnalysisMetadata({ color_base: [] }),
    ),
  ).toBe(false);
});

test("wardrobe image analysis calls fixed DeepInfra Gemma model and logs response", async () => {
  const generateJsonWithLlmImpl = vi.fn(async () => ({
    response: { choices: [], output_text: '{"name":"Linen shirt"}' },
    json: { name: "Linen shirt" },
  }));
  const logInfoImpl = vi.fn();

  const result = await analyzeWardrobeImageUrl({
    imageUrl: "https://images.example.com/item.webp",
    generateJsonWithLlmImpl,
    logInfoImpl,
  });

  expect(result.hasMetadata).toBe(true);
  expect(result.metadata.name).toBe("Linen shirt");
  expect(result.metadata.is_neutral).toBe(false);
  expect(generateJsonWithLlmImpl).toHaveBeenCalledWith(
    expect.stringContaining("System:"),
    expect.objectContaining({
      images: [{ imageUrl: "https://images.example.com/item.webp" }],
      systemPrompt: " ",
      userProfile: { llm: "deepinfra:google/gemma-4-31B-it" },
    }),
  );
  expect(logInfoImpl).toHaveBeenCalledWith(
    "[wardrobe-image-analysis][llm-response]",
    expect.stringContaining("https://images.example.com/item.webp"),
  );
});

test("wardrobe image analysis falls back to JSON stringified raw responses", async () => {
  const generateJsonWithLlmImpl = vi.fn(async () => ({
    response: { choices: [], output_text: undefined as unknown as string },
    json: { category: "dress" },
  }));

  const result = await analyzeWardrobeImageUrl({
    imageUrl: "https://images.example.com/item.webp",
    generateJsonWithLlmImpl,
    logInfoImpl: vi.fn(),
  });

  expect(result.rawResponse).toBe('{"category":"dress"}');
  expect(result.metadata.category).toBe("dress");
  expect(result.metadata.is_neutral).toBe(false);
});
