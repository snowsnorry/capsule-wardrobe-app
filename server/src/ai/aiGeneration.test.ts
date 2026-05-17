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

test("generateCapsuleWardrobe injects anchors and repairs missing anchor selections", async () => {
  const llmPrompts = [];
  const generateCapsuleWardrobe = createGenerateCapsuleWardrobe(
    createBaseDeps({
      validateCapsuleAnchorItemsImpl: async () => ({
        anchorWardrobeItemIds: ["W12"],
        anchorWardrobeNumericIds: [12],
        anchorItems: [
          {
            id: "W12",
            item_source: "wardrobe",
            selection_role: "anchor",
            wardrobe_id: "12",
            name: "White shirt",
            category: "top",
            image_url: "https://example.com/anchor.jpg",
          },
        ],
      }),
      queryCapsuleWardrobeItemsForProfileImpl: async () => [
        {
          id: "W12",
          item_source: "wardrobe",
          selection_role: "anchor",
          wardrobe_id: "12",
          name: "White shirt",
          category: "top",
          image_url: "https://example.com/anchor.jpg",
        },
        ...createWardrobeRows().map((row) => ({
          ...row,
          selection_role: "candidate",
        })),
      ],
      getGenerateJsonWithLlmImpl: () => async (prompt, options) => {
        llmPrompts.push(prompt);
        options.onPayloadBuilt?.();
        const isRepair = String(prompt).includes("Missing anchor ids: W12");
        return {
          response: { output_text: isRepair ? " repaired " : " missing " },
          json: {
            capsule: isRepair
              ? {
                  top: ["W12"],
                  bottom: ["bottom-1"],
                  bag: ["bag-1"],
                }
              : {
                  top: ["top-1"],
                  bottom: ["bottom-1"],
                  bag: ["bag-1"],
                },
            outfit_formulas: [],
            system_evaluation: {
              short_capsule_name: "Anchor edit",
            },
          },
        };
      },
    }),
  );

  const result = await generateCapsuleWardrobe({
    email: "person@example.com",
    audience: "woman",
    season: ["spring"],
    anchorWardrobeItemIds: ["W12"],
  });

  expect(llmPrompts[0]).toContain("ANCHOR ITEMS - MANDATORY");
  expect(llmPrompts[0]).toContain('"id": "W12"');
  expect(llmPrompts[1]).toContain("Missing anchor ids: W12");
  expect(result.items.map((item) => item.id)).toContain("W12");
  expect(result.rawSelectionText).toBe("repaired");
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
