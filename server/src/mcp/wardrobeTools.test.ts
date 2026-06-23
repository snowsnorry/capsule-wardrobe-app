import { expect, test, vi } from "vitest";

import { registerWardrobeTools } from "./wardrobeTools.js";

function createToolRegistry() {
  const tools = new Map<
    string,
    {
      config: Record<string, unknown>;
      handler: (args?: Record<string, unknown>) => Promise<unknown>;
    }
  >();
  const server = {
    registerTool: vi.fn((name, config, handler) => {
      tools.set(name, { config, handler });
    }),
  };

  return { server, tools };
}

function createWardrobeItem() {
  return {
    id: "wardrobe-1",
    name: "Saved blazer",
    brand: "Acme",
    url: "https://example.test/products/saved-blazer",
    description: null,
    price: { amount: 120, currency: "USD", display: "120 USD" },
    availability: null,
    image: "https://example.test/saved-blazer.webp",
    audience: null,
    category: "jacket",
    attributes: {
      season: ["winter"],
      formalityLevel: null,
      style: null,
      occasions: null,
      colorBase: null,
      pattern: null,
      finish: null,
      isNeutral: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: null,
      isSavedToWardrobe: null,
    },
    source: "from_catalog",
    processingStatus: "ready",
  };
}

test("render wardrobe grid drops unsafe action and image URLs", async () => {
  const { server, tools } = createToolRegistry();
  registerWardrobeTools(server, {
    profileEmail: "user@example.test",
    listWardrobeItemsImpl: vi.fn(),
  });

  const result = await tools.get("render_wardrobe_grid")?.handler({
    items: [
      {
        ...createWardrobeItem(),
        url: "javascript:alert(1)",
        image: "data:text/html,<script>alert(1)</script>",
      },
    ],
  });

  expect(result).toMatchObject({
    content: [
      {
        type: "text",
        text: "Found 1 wardrobe items:\n1. Saved blazer - Acme - 120 USD - from_catalog - ready",
      },
    ],
    structuredContent: {
      resultType: "wardrobe_items",
      count: 1,
      items: [
        {
          url: "",
          image: null,
        },
      ],
    },
    _meta: {
      cards: [
        {
          type: "wardrobe_item_card",
          image: null,
        },
      ],
    },
  });
  const card = (
    result as { _meta?: { cards?: Array<Record<string, unknown>> } }
  )._meta?.cards?.[0];
  expect(card).not.toHaveProperty("primaryAction");
});

test("render wardrobe grid preserves uploaded item internal URLs", async () => {
  const { server, tools } = createToolRegistry();
  registerWardrobeTools(server, {
    profileEmail: "user@example.test",
    listWardrobeItemsImpl: vi.fn(),
  });

  const result = await tools.get("render_wardrobe_grid")?.handler({
    items: [
      {
        ...createWardrobeItem(),
        url: "wardrobe://wardrobe-1",
        source: "uploaded",
      },
    ],
  });

  expect(result).toMatchObject({
    structuredContent: {
      items: [
        {
          url: "wardrobe://wardrobe-1",
          source: "uploaded",
        },
      ],
    },
    _meta: {
      cards: [
        {
          image: "https://example.test/saved-blazer.webp",
        },
      ],
    },
  });
  const card = (
    result as { _meta?: { cards?: Array<Record<string, unknown>> } }
  )._meta?.cards?.[0];
  expect(card).not.toHaveProperty("primaryAction");
});
