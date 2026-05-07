import { test, expect, vi } from "vitest";
import { createRegenerateCapsuleWardrobe } from "./regenerateSelectedGeneration.js";

const currentItems = [
  { id: "top-old", url: "https://example.com/top-old", name: "Old Top", category: "top" },
  { id: "bottom-1", url: "https://example.com/bottom", name: "Bottom", category: "bottom" },
  { id: "bag-1", url: "https://example.com/bag", name: "Bag", category: "bag" }
];
const selectedProducts = [currentItems[0]];
const candidates = [
  { id: "top-new", url: "https://example.com/top-new", name: "New Top", category: "top", image_url: "https://example.com/top-new.jpg", embedding: [1, 0] }
];

function createProfile(overrides = {}) {
  return {
    audience: "woman",
    season: ["spring"],
    style: "minimalistic",
    items: {
      items: currentItems
    },
    ...overrides
  };
}

function createBaseDeps(overrides = {}) {
  return {
    getWardrobePromptImpl: () => "wardrobe prompt",
    getPromptEmbeddingsImpl: async () => [0.5, 0.5],
    getProductsByUrlsInOrderImpl: async (urls) => urls.map((url) => ({ url, name: `Prompt ${url}` })),
    getProductsWithEmbeddingsByUrlsInOrderImpl: async () => [],
    getSqlClientImpl: () => "sql-client",
    queryRegenerationCandidateItemsImpl: async () => candidates,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
      fallbackReason: null
    }),
    isNoLlmProfileEnabledImpl: () => false,
    runWithImageWorkSlotImpl: async (_key, callback) => callback(),
    buildPromptDebugImagesInChildImpl: async () => ({
      categories: [{ buffer: Buffer.from("candidate"), mimeType: "image/jpeg" }],
      stitched: null,
      cachedCount: 1
    }),
    buildPromptDebugImagesForCategoryImpl: async () => ({
      category: { buffer: Buffer.from("current"), mimeType: "image/jpeg", cachedCount: 1 }
    }),
    getGenerateJsonWithLlmImpl: () => async (_prompt, options) => {
      options.onPayloadBuilt?.();
      return {
        response: { output_text: " Raw regeneration " },
        json: {
          regenerated_items: {
            top: ["top-new"]
          },
          outfit_formulas: []
        }
      };
    },
    ...overrides
  };
}

test("regenerateCapsuleWardrobe builds a no-LLM replacement from SQL candidates", async () => {
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(createBaseDeps({
    isNoLlmProfileEnabledImpl: () => true,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "none",
      provider: "none",
      model: null
    })
  }));

  const result = await regenerateCapsuleWardrobe(createProfile({ llm: "none" }), selectedProducts);

  expect(result.promptEmbeddings).toEqual([0.5, 0.5]);
  expect(result.selectedItems.map((item) => item.id)).toEqual(["top-new"]);
  expect(result.items.map((item) => item.id)).toEqual(["bottom-1", "bag-1", "top-new"]);
  expect(result.rawSelectionText).toBe(null);
});

test("regenerateCapsuleWardrobe uses current capsule and candidate images for LLM selection", async () => {
  const imageCalls = [];
  const llmCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(createBaseDeps({
    buildPromptDebugImagesInChildImpl: async (payload) => {
      imageCalls.push({ type: "candidates", payload });
      return {
        categories: [{ buffer: Buffer.from("candidate"), mimeType: "image/jpeg" }],
        stitched: { buffer: Buffer.from("stitched"), mimeType: "image/jpeg" }
      };
    },
    buildPromptDebugImagesForCategoryImpl: async (payload) => {
      imageCalls.push({ type: "current", payload });
      return {
        category: { buffer: Buffer.from("current"), mimeType: "image/jpeg" }
      };
    },
    getGenerateJsonWithLlmImpl: () => async (prompt, options) => {
      llmCalls.push({ prompt, images: options.images, systemPrompt: options.systemPrompt });
      options.onPayloadBuilt?.();
      return {
        response: { output_text: " Raw regeneration " },
        json: {
          regenerated_items: {
            top: ["top-new", "top-new"]
          },
          outfit_formulas: []
        }
      };
    }
  }));

  const result = await regenerateCapsuleWardrobe(createProfile(), selectedProducts);

  expect(imageCalls.map((call) => call.type)).toEqual(["candidates", "current"]);
  expect(llmCalls.length).toBe(1);
  expect(llmCalls[0].images.length).toBe(2);
  expect(llmCalls[0].systemPrompt).toMatch(/Current Capsule/);
  expect(result.items.map((item) => item.id)).toEqual(["bottom-1", "bag-1", "top-new"]);
  expect(result.rawSelectionText).toBe("Raw regeneration");
});

test("regenerateCapsuleWardrobe handles image failures and empty LLM payloads", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(createBaseDeps({
    buildPromptDebugImagesInChildImpl: async () => {
      throw new Error("prompt_images_child_exit:1");
    },
    buildPromptDebugImagesForCategoryImpl: async () => {
      throw new Error("current_collage_failed");
    },
    getGenerateJsonWithLlmImpl: () => async (_prompt, options) => {
      expect(options.images).toEqual([]);
      return {
        response: { output_text: "empty" },
        json: {}
      };
    }
  }));

  const result = await regenerateCapsuleWardrobe(createProfile(), selectedProducts);

  expect(result.items.map((item) => item.id)).toEqual(["bottom-1", "bag-1", "top-new"]);
  expect(result.rawSelectionText).toBe("empty");
});

test("regenerateCapsuleWardrobe rejects requests without selected product categories or SQL candidates", async () => {
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(createBaseDeps());
  await expect(() => regenerateCapsuleWardrobe(createProfile(), [])).rejects.toThrow(/No selected product categories/);

  const noCandidateRegeneration = createRegenerateCapsuleWardrobe(createBaseDeps({
    isNoLlmProfileEnabledImpl: () => true,
    queryRegenerationCandidateItemsImpl: async () => []
  }));
  await expect(() => noCandidateRegeneration(createProfile({ llm: "none" }), selectedProducts)).rejects.toThrow(/SQL returned no valid regenerated items/);
});
