import { test, expect, vi } from "vitest";
import { createRegenerateCapsuleWardrobe } from "./regenerateSelectedGeneration.js";

const currentItems = [
  {
    id: "top-old",
    url: "https://example.com/top-old",
    name: "Old Top",
    category: "top",
  },
  {
    id: "bottom-1",
    url: "https://example.com/bottom",
    name: "Bottom",
    category: "bottom",
  },
  { id: "bag-1", url: "https://example.com/bag", name: "Bag", category: "bag" },
];
const selectedProducts = [currentItems[0]];
const candidates = [
  {
    id: "top-new",
    url: "https://example.com/top-new",
    name: "New Top",
    category: "top",
    image_url: "https://example.com/top-new.jpg",
    embedding: [1, 0],
  },
];
const swimwearSelectedProducts = [
  {
    id: "swim-old",
    url: "https://example.com/swim-old",
    name: "Old Swimsuit",
    category: "swimwear",
  },
];
function createProfile(overrides = {}) {
  return {
    audience: "woman",
    season: ["spring"],
    style: "minimalistic",
    items: {
      items: currentItems,
    },
    ...overrides,
  };
}

function createBaseDeps(overrides = {}) {
  return {
    getWardrobePromptImpl: () => "wardrobe prompt",
    getPromptEmbeddingsImpl: async () => [0.5, 0.5],
    getProductsByUrlsInOrderImpl: async (urls) =>
      urls.map((url) => ({ url, name: `Prompt ${url}` })),
    getProductsWithEmbeddingsByUrlsInOrderImpl: async () => [],
    getSqlClientImpl: () => "sql-client",
    queryRegenerationCandidateItemsImpl: async () => candidates,
    resolveLlmProviderImpl: () => ({
      requestedLlm: "openai:gpt-5.5",
      provider: "openai",
      model: "gpt-5.5",
      fallbackReason: null,
    }),
    isNoLlmProfileEnabledImpl: () => false,
    runWithImageWorkSlotImpl: async (_key, callback) => callback(),
    buildPromptDebugImagesInChildImpl: async () => ({
      categories: [
        { buffer: Buffer.from("candidate"), mimeType: "image/jpeg" },
      ],
      stitched: null,
      cachedCount: 1,
    }),
    buildPromptDebugImagesForCategoryImpl: async () => ({
      category: {
        buffer: Buffer.from("current"),
        mimeType: "image/jpeg",
        cachedCount: 1,
      },
    }),
    getGenerateJsonWithLlmImpl: () => async (_prompt, options) => {
      options.onPayloadBuilt?.();
      return {
        response: { output_text: " Raw regeneration " },
        json: {
          regenerated_items: {
            top: ["top-new"],
          },
          outfit_formulas: [],
        },
      };
    },
    ...overrides,
  };
}

test("regenerateCapsuleWardrobe builds a no-LLM replacement from SQL candidates", async () => {
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      isNoLlmProfileEnabledImpl: () => true,
      resolveLlmProviderImpl: () => ({
        requestedLlm: "none",
        provider: "none",
        model: null,
      }),
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile({ llm: "none" }),
    selectedProducts,
  );

  expect(result.promptEmbeddings).toEqual([0.5, 0.5]);
  expect(result.selectedItems.map((item) => item.id)).toEqual(["top-new"]);
  expect(result.items.map((item) => item.id)).toEqual([
    "bottom-1",
    "bag-1",
    "top-new",
  ]);
  expect(result.rawSelectionText).toBe(null);
});

test("regenerateCapsuleWardrobe forwards source mode and profile email to SQL candidate lookup", async () => {
  const queryCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      isNoLlmProfileEnabledImpl: () => true,
      queryRegenerationCandidateItemsImpl: async (sql, params) => {
        queryCalls.push({ sql, params });
        return candidates;
      },
      resolveLlmProviderImpl: () => ({
        requestedLlm: "none",
        provider: "none",
        model: null,
      }),
    }),
  );

  await regenerateCapsuleWardrobe(
    createProfile({
      email: " person@example.com ",
      llm: "none",
      sourceMode: "wardrobe_only",
    }),
    selectedProducts,
  );

  expect(queryCalls).toHaveLength(1);
  expect(queryCalls[0].sql).toBe("sql-client");
  expect(queryCalls[0].params).toMatchObject({
    categories: ["top"],
    profileEmail: "person@example.com",
    sourceMode: "wardrobe_only",
  });
});

test("regenerateCapsuleWardrobe uses current capsule and candidate images for LLM selection", async () => {
  const imageCalls = [];
  const llmCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      buildPromptDebugImagesInChildImpl: async (payload) => {
        imageCalls.push({ type: "candidates", payload });
        return {
          categories: [
            { buffer: Buffer.from("candidate"), mimeType: "image/jpeg" },
          ],
          stitched: { buffer: Buffer.from("stitched"), mimeType: "image/jpeg" },
        };
      },
      buildPromptDebugImagesForCategoryImpl: async (payload) => {
        imageCalls.push({ type: "current", payload });
        return {
          category: { buffer: Buffer.from("current"), mimeType: "image/jpeg" },
        };
      },
      getGenerateJsonWithLlmImpl: () => async (prompt, options) => {
        llmCalls.push({
          prompt,
          images: options.images,
          systemPrompt: options.systemPrompt,
        });
        options.onPayloadBuilt?.();
        return {
          response: { output_text: " Raw regeneration " },
          json: {
            regenerated_items: {
              top: ["top-new", "top-new"],
            },
            outfit_formulas: [],
          },
        };
      },
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile(),
    selectedProducts,
  );

  expect(imageCalls.map((call) => call.type)).toEqual([
    "candidates",
    "current",
  ]);
  expect(llmCalls.length).toBe(1);
  expect(llmCalls[0].images.length).toBe(2);
  expect(llmCalls[0].systemPrompt).toMatch(/Current Capsule/);
  expect(result.items.map((item) => item.id)).toEqual([
    "bottom-1",
    "bag-1",
    "top-new",
  ]);
  expect(result.rawSelectionText).toBe("Raw regeneration");
});

test("regenerateCapsuleWardrobe handles image failures and empty LLM payloads", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
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
          json: {},
        };
      },
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile(),
    selectedProducts,
  );

  expect(result.items.map((item) => item.id)).toEqual([
    "bottom-1",
    "bag-1",
    "top-new",
  ]);
  expect(result.rawSelectionText).toBe("empty");
});

test("regenerateCapsuleWardrobe rejects requests without selected product categories or SQL candidates", async () => {
  const regenerateCapsuleWardrobe =
    createRegenerateCapsuleWardrobe(createBaseDeps());
  await expect(() =>
    regenerateCapsuleWardrobe(createProfile(), []),
  ).rejects.toThrow(/No selected product categories/);

  const noCandidateRegeneration = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      isNoLlmProfileEnabledImpl: () => true,
      queryRegenerationCandidateItemsImpl: async () => [],
    }),
  );
  await expect(() =>
    noCandidateRegeneration(createProfile({ llm: "none" }), selectedProducts),
  ).rejects.toThrow(/SQL returned no valid regenerated items/);
});

test("regenerateCapsuleWardrobe replaces a selected one-piece through full swimwear selection", async () => {
  const swimwearCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      queryRegenerationCandidateItemsImpl: async () => {
        throw new Error("regular SQL should not run for swimwear-only");
      },
      generateSwimwearAdditionImpl: async (payload) => {
        swimwearCalls.push(payload);
        return {
          items: [
            {
              id: "swim-new",
              url: "https://example.com/swim-new",
              name: "New Swimsuit",
              category: "swimwear",
              swimwearType: "swimsuit",
            },
          ],
          reasoning: null,
          rawSelectionText: "swimwear raw",
        };
      },
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile({
      items: { items: [...currentItems, ...swimwearSelectedProducts] },
    }),
    [{ ...swimwearSelectedProducts[0], swimwearType: "swimsuit" }],
  );

  expect(swimwearCalls).toHaveLength(1);
  expect(swimwearCalls[0]).toMatchObject({
    force: true,
    promptEmbeddings: [0.5, 0.5],
  });
  expect(result.items.map((item) => item.id)).toEqual([
    "top-old",
    "bottom-1",
    "bag-1",
    "swim-new",
  ]);
  expect(result.selectedItems.map((item) => item.id)).toEqual(["swim-new"]);
  expect(result.rawSelectionText).toBe("swimwear raw");
});

test("regenerateCapsuleWardrobe replaces one selected bikini part by completing the remaining counterpart", async () => {
  const swimTop = {
    id: "swim-top-old",
    url: "https://example.com/swim-top-old",
    name: "Old Bikini Top",
    category: "swimwear",
    swimwearType: "swimwear_top",
  };
  const swimBottom = {
    id: "swim-bottom-old",
    url: "https://example.com/swim-bottom-old",
    name: "Old Bikini Bottom",
    category: "swimwear",
    swimwearType: "swimwear_bottom",
  };
  const swimwearCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      generateSwimwearAdditionImpl: async (payload) => {
        swimwearCalls.push(payload);
        return {
          items: [
            {
              id: "swim-top-new",
              url: "https://example.com/swim-top-new",
              name: "New Bikini Top",
              category: "swimwear",
              swimwearType: "swimwear_top",
            },
          ],
          reasoning: null,
          rawSelectionText: null,
        };
      },
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile({ items: { items: [...currentItems, swimTop, swimBottom] } }),
    [swimTop],
  );

  expect(swimwearCalls).toHaveLength(1);
  expect(swimwearCalls[0].force).toBe(false);
  expect(swimwearCalls[0].selectedCapsuleItems.map((item) => item.id)).toEqual([
    "top-old",
    "bottom-1",
    "bag-1",
    "swim-bottom-old",
  ]);
  expect(result.items.map((item) => item.id)).toEqual([
    "top-old",
    "bottom-1",
    "bag-1",
    "swim-bottom-old",
    "swim-top-new",
  ]);
});

test("regenerateCapsuleWardrobe replaces both selected bikini parts through full swimwear selection", async () => {
  const swimTop = {
    id: "swim-top-old",
    url: "https://example.com/swim-top-old",
    name: "Old Bikini Top",
    category: "swimwear",
    swimwearType: "swimwear_top",
  };
  const swimBottom = {
    id: "swim-bottom-old",
    url: "https://example.com/swim-bottom-old",
    name: "Old Bikini Bottom",
    category: "swimwear",
    swimwearType: "swimwear_bottom",
  };
  const swimwearCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      generateSwimwearAdditionImpl: async (payload) => {
        swimwearCalls.push(payload);
        return {
          items: [
            {
              id: "swim-new",
              url: "https://example.com/swim-new",
              name: "New Swimsuit",
              category: "swimwear",
              swimwearType: "swimsuit",
            },
          ],
          reasoning: null,
          rawSelectionText: null,
        };
      },
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile({ items: { items: [...currentItems, swimTop, swimBottom] } }),
    [swimTop, swimBottom],
  );

  expect(swimwearCalls[0].force).toBe(true);
  expect(result.items.map((item) => item.id)).toEqual([
    "top-old",
    "bottom-1",
    "bag-1",
    "swim-new",
  ]);
});

test("regenerateCapsuleWardrobe regenerates mixed non-swimwear and swimwear selections", async () => {
  const swimTop = {
    id: "swim-top-old",
    url: "https://example.com/swim-top-old",
    name: "Old Bikini Top",
    category: "swimwear",
    swimwearType: "swimwear_top",
  };
  const swimBottom = {
    id: "swim-bottom-old",
    url: "https://example.com/swim-bottom-old",
    name: "Old Bikini Bottom",
    category: "swimwear",
    swimwearType: "swimwear_bottom",
  };
  const queryCalls = [];
  const swimwearCalls = [];
  const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe(
    createBaseDeps({
      isNoLlmProfileEnabledImpl: () => true,
      queryRegenerationCandidateItemsImpl: async (_sql, params) => {
        queryCalls.push(params);
        return candidates;
      },
      generateSwimwearAdditionImpl: async (payload) => {
        swimwearCalls.push(payload);
        return {
          items: [
            {
              id: "swim-top-new",
              url: "https://example.com/swim-top-new",
              name: "New Bikini Top",
              category: "swimwear",
              swimwearType: "swimwear_top",
            },
          ],
          reasoning: null,
          rawSelectionText: null,
        };
      },
      resolveLlmProviderImpl: () => ({
        requestedLlm: "none",
        provider: "none",
        model: null,
      }),
    }),
  );

  const result = await regenerateCapsuleWardrobe(
    createProfile({
      llm: "none",
      items: { items: [...currentItems, swimTop, swimBottom] },
    }),
    [selectedProducts[0], swimTop],
  );

  expect(queryCalls).toHaveLength(1);
  expect(queryCalls[0].categories).toEqual(["top"]);
  expect(swimwearCalls).toHaveLength(1);
  expect(swimwearCalls[0].force).toBe(false);
  expect(result.items.map((item) => item.id)).toEqual([
    "bottom-1",
    "bag-1",
    "swim-bottom-old",
    "top-new",
    "swim-top-new",
  ]);
  expect(result.selectedItems.map((item) => item.id)).toEqual([
    "top-new",
    "swim-top-new",
  ]);
});
