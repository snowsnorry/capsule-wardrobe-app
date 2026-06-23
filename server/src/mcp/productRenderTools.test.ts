import { expect, test, vi } from "vitest";

import {
  registerRenderProductDetailTool,
  registerRenderProductGridTool,
} from "./productRenderTools.js";

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

function createProductItem() {
  return {
    id: "product-1",
    name: "Black Blazer",
    url: "https://example.test/products/black-blazer",
    brand: "Acme",
    description: null,
    price: { amount: 120, currency: "USD", display: "120 USD" },
    availability: null,
    image: "https://example.test/black-blazer.webp",
    audience: null,
    category: "outerwear",
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
  };
}

test("render product grid returns fallback text without items", async () => {
  const { server, tools } = createToolRegistry();
  registerRenderProductGridTool(server);

  const result = await tools.get("render_product_grid")?.handler({});

  expect(result).toMatchObject({
    content: [
      {
        type: "text",
        text: "Found 0 products.",
      },
    ],
    structuredContent: {
      resultType: "product_search",
      count: 0,
      items: [],
      total: 0,
      offset: 0,
      limit: 0,
    },
    _meta: {
      ui: {
        component: "product_grid",
        itemOrder: [],
      },
      cards: [],
      itemsById: {},
    },
  });
});

test("render product grid normalizes scalar array-like attributes", async () => {
  const { server, tools } = createToolRegistry();
  registerRenderProductGridTool(server);

  const item = {
    ...createProductItem(),
    attributes: {
      ...createProductItem().attributes,
      formalityLevel: " formal ",
      closureType: "button",
    },
  };

  const result = await tools.get("render_product_grid")?.handler({
    items: [item],
  });

  expect(result).toMatchObject({
    structuredContent: {
      items: [
        {
          attributes: {
            formalityLevel: ["formal"],
            closureType: ["button"],
          },
        },
      ],
    },
  });
});

test("render product grid drops unsafe action and image URLs", async () => {
  const { server, tools } = createToolRegistry();
  registerRenderProductGridTool(server);

  const result = await tools.get("render_product_grid")?.handler({
    items: [
      {
        ...createProductItem(),
        url: "javascript:alert(1)",
        image: "data:text/html,<script>alert(1)</script>",
      },
    ],
  });

  expect(result).toMatchObject({
    structuredContent: {
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

test("render product detail returns fallback text", async () => {
  const { server, tools } = createToolRegistry();
  registerRenderProductDetailTool(server);

  const item = createProductItem();

  const result = await tools.get("render_product_detail")?.handler({ item });

  expect(result).toMatchObject({
    content: [
      {
        type: "text",
        text: [
          "Fetched product:",
          "Black Blazer - Acme - 120 USD",
          "![Black Blazer](https://example.test/black-blazer.webp)",
          "https://example.test/products/black-blazer",
        ].join("\n"),
      },
    ],
    structuredContent: {
      resultType: "product_fetch",
      item,
      items: [item],
    },
  });
});

test("render product detail drops unsafe action and image URLs", async () => {
  const { server, tools } = createToolRegistry();
  registerRenderProductDetailTool(server);

  const result = await tools.get("render_product_detail")?.handler({
    item: {
      ...createProductItem(),
      url: "javascript:alert(1)",
      image: "data:image/svg+xml,<svg onload=alert(1)>",
    },
  });

  expect(result).toMatchObject({
    content: [
      {
        type: "text",
        text: ["Fetched product:", "Black Blazer - Acme - 120 USD"].join("\n"),
      },
    ],
    structuredContent: {
      item: {
        url: "",
        image: null,
      },
      items: [
        {
          url: "",
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

test("render product detail normalizes scalar array-like attributes", async () => {
  const { server, tools } = createToolRegistry();
  registerRenderProductDetailTool(server);

  const item = {
    ...createProductItem(),
    attributes: {
      ...createProductItem().attributes,
      formalityLevel: "formal",
      closureType: " button ",
    },
  };

  const result = await tools.get("render_product_detail")?.handler({ item });

  expect(result).toMatchObject({
    structuredContent: {
      item: {
        attributes: {
          formalityLevel: ["formal"],
          closureType: ["button"],
        },
      },
    },
  });
});
