import { test, expect, vi } from "vitest";
import { createGenerateCapsuleWardrobe } from "./aiGeneration.js";

function createWardrobeRows() {
  return [
    {
      id: "top-1",
      url: "https://example.com/top",
      name: "Top",
      category: "top",
      image_url: "https://example.com/top.jpg",
      embedding: [1],
    },
    {
      id: "bottom-1",
      url: "https://example.com/bottom",
      name: "Bottom",
      category: "bottom",
      image_url: "https://example.com/bottom.jpg",
      embedding: [1],
    },
    {
      id: "bag-1",
      url: "https://example.com/bag",
      name: "Bag",
      category: "bag",
      image_url: "https://example.com/bag.jpg",
      embedding: [1],
    },
  ];
}

function createBaseDeps(overrides = {}) {
  return {
    getWardrobePromptImpl: () => "wardrobe prompt",
    getPromptEmbeddingsImpl: async () => [0.1, 0.2],
    buildCapsuleWardrobeSqlParamsImpl: (
      _profile,
      promptEmbeddings,
      categories,
    ) => ({ promptEmbeddings, categories }),
    getSqlClientImpl: () => "sql-client",
    queryCapsuleWardrobeItemsForProfileImpl: async () => createWardrobeRows(),
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
      fallbackReason: null,
    }),
    isNoLlmProfileEnabledImpl: () => false,
    runWithImageWorkSlotImpl: async (_key, callback) => callback(),
    buildPromptDebugImagesInChildImpl: async () => ({
      categories: [{ buffer: Buffer.from("category"), mimeType: "image/jpeg" }],
      stitched: null,
      cachedCount: 1,
      downloadedCount: 2,
      skippedCount: 0,
    }),
    getGenerateJsonWithLlmImpl: () => async (_prompt, options) => {
      options.onPayloadBuilt?.();
      return {
        response: {
          output_text: " Raw selected text ",
          usage: { input_tokens: 5, output_tokens: 4 },
        },
        json: {
          capsule: {
            top: ["top-1"],
            bottom: ["bottom-1"],
            bag: ["bag-1"],
          },
          outfit_formulas: [],
          system_evaluation: {
            short_capsule_name: "Spring edit",
          },
        },
      };
    },
    ...overrides,
  };
}

test("generateCapsuleWardrobe builds a no-LLM result from SQL candidates", async () => {
  const generateCapsuleWardrobe = createGenerateCapsuleWardrobe(
    createBaseDeps({
      isNoLlmProfileEnabledImpl: () => true,
      resolveLlmProviderImpl: () => ({
        requestedLlm: "none",
        provider: "none",
        model: null,
      }),
    }),
  );

  const result = await generateCapsuleWardrobe({
    audience: "woman",
    season: ["spring"],
    llm: "none",
  });

  expect(result.promptEmbeddings).toEqual([0.1, 0.2]);
  expect(result.rawSelectionText).toBe(null);
  expect(result.shortCapsuleName).toBe(null);
  expect(result.items.map((item) => item.id).sort()).toEqual([
    "bag-1",
    "bottom-1",
    "top-1",
  ]);
  expect(result.selectedItems.map((item) => item.embedding)).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
});

test("generateCapsuleWardrobe uses LLM selection, prompt images, and short capsule name", async () => {
  const imageCalls = [];
  const llmCalls = [];
  const generateCapsuleWardrobe = createGenerateCapsuleWardrobe(
    createBaseDeps({
      buildPromptDebugImagesInChildImpl: async (payload) => {
        imageCalls.push(payload);
        return {
          categories: [
            { buffer: Buffer.from("category"), mimeType: "image/jpeg" },
          ],
          stitched: { buffer: Buffer.from("stitched"), mimeType: "image/jpeg" },
          cachedCount: 1,
        };
      },
      getGenerateJsonWithLlmImpl: () => async (prompt, options) => {
        llmCalls.push({ prompt, images: options.images });
        options.onPayloadBuilt?.();
        return {
          response: { output_text: " Raw selected text " },
          json: {
            capsule: {
              top: ["top-1", "top-1"],
              bottom: ["bottom-1"],
              bag: ["bag-1"],
            },
            outfit_formulas: [],
            system_evaluation: {
              short_capsule_name: "Weekend Capsule",
            },
          },
        };
      },
    }),
  );

  const result = await generateCapsuleWardrobe({
    audience: "woman",
    season: ["spring"],
    style: "minimalistic",
  });

  expect(imageCalls.length).toBe(1);
  expect(llmCalls.length).toBe(1);
  expect(llmCalls[0].images.length).toBe(1);
  expect(llmCalls[0].images[0].buffer.toString()).toBe("stitched");
  expect(result.items.map((item) => item.id).sort()).toEqual([
    "bag-1",
    "bottom-1",
    "top-1",
  ]);
  expect(result.shortCapsuleName).toBe("Weekend Capsule");
  expect(result.rawSelectionText).toBe("Raw selected text");
});

test("generateCapsuleWardrobe continues without prompt images and reports empty selections", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const generateCapsuleWardrobe = createGenerateCapsuleWardrobe(
    createBaseDeps({
      buildPromptDebugImagesInChildImpl: async () => {
        throw new Error("prompt_images_child_exit:1");
      },
      getGenerateJsonWithLlmImpl: () => async (_prompt, options) => {
        expect(options.images).toEqual([]);
        return {
          response: {
            output_text: "not json",
            output: [{ type: "message" }],
            status: "completed",
          },
          json: {},
        };
      },
    }),
  );

  const result = await generateCapsuleWardrobe({
    audience: "woman",
    season: ["spring"],
  });
  expect(result.items.map((item) => item.id).sort()).toEqual([
    "bag-1",
    "bottom-1",
    "top-1",
  ]);
});

test("generateCapsuleWardrobe rejects empty no-LLM SQL results", async () => {
  const generateCapsuleWardrobe = createGenerateCapsuleWardrobe(
    createBaseDeps({
      isNoLlmProfileEnabledImpl: () => true,
      queryCapsuleWardrobeItemsForProfileImpl: async () => [],
    }),
  );

  await expect(() =>
    generateCapsuleWardrobe({
      audience: "woman",
      season: ["spring"],
      llm: "none",
    }),
  ).rejects.toThrow(/SQL returned no valid wardrobe items/);
});
