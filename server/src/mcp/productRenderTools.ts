import { z } from "zod";

import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import {
  PRODUCT_DETAIL_WIDGET_URI,
  PRODUCT_GRID_WIDGET_URI,
} from "./productGridWidget.js";
import {
  buildProductDetailMeta,
  buildProductGridMeta,
  formatProductFetchText,
  formatProductSearchText,
  type ProductToolCardItem,
} from "./productToolCards.js";

const STRING_ARRAY_SCHEMA = z.array(z.string());
const NULLABLE_STRING_SCHEMA = z.string().nullable();
const NULLABLE_STRING_ARRAY_SCHEMA = STRING_ARRAY_SCHEMA.nullable();
const FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA = z
  .union([STRING_ARRAY_SCHEMA, z.string()])
  .nullable();
const NULLABLE_BOOLEAN_SCHEMA = z.boolean().nullable();
const NULLABLE_PRICE_SCHEMA = z.union([z.number(), z.string()]).nullable();
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const RENDER_PRODUCT_GRID_DESCRIPTION =
  "Compatibility helper for rendering product search results returned by `search`. Use only if the client did not already render the search result as a visual product grid.";
const RENDER_PRODUCT_DETAIL_DESCRIPTION =
  "Render a product returned by `fetch` for clients that support OpenAI output templates. The result also includes a markdown image link as a fallback.";
const PRODUCT_GRID_RENDER_TOOL_META = {
  ui: {
    resourceUri: PRODUCT_GRID_WIDGET_URI,
  },
  "openai/outputTemplate": PRODUCT_GRID_WIDGET_URI,
  "openai/toolInvocation/invoking": "Searching products",
  "openai/toolInvocation/invoked": "Products ready",
} as const;
const PRODUCT_DETAIL_RENDER_TOOL_META = {
  ui: {
    resourceUri: PRODUCT_DETAIL_WIDGET_URI,
  },
  "openai/outputTemplate": PRODUCT_DETAIL_WIDGET_URI,
  "openai/toolInvocation/invoking": "Fetching product",
  "openai/toolInvocation/invoked": "Product ready",
} as const;

const PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  brand: NULLABLE_STRING_SCHEMA,
  description: NULLABLE_STRING_SCHEMA,
  price: z.object({
    amount: NULLABLE_PRICE_SCHEMA,
    currency: NULLABLE_STRING_SCHEMA,
    display: NULLABLE_STRING_SCHEMA,
  }),
  availability: NULLABLE_STRING_SCHEMA,
  image: NULLABLE_STRING_SCHEMA,
  audience: NULLABLE_STRING_SCHEMA,
  category: NULLABLE_STRING_SCHEMA,
  attributes: z.object({
    season: NULLABLE_STRING_ARRAY_SCHEMA,
    formalityLevel: NULLABLE_STRING_ARRAY_SCHEMA,
    style: NULLABLE_STRING_ARRAY_SCHEMA,
    occasions: NULLABLE_STRING_ARRAY_SCHEMA,
    colorBase: NULLABLE_STRING_ARRAY_SCHEMA,
    pattern: NULLABLE_STRING_SCHEMA,
    finish: NULLABLE_STRING_SCHEMA,
    isNeutral: NULLABLE_BOOLEAN_SCHEMA,
    composition: NULLABLE_STRING_SCHEMA,
    silhouette: NULLABLE_STRING_SCHEMA,
    fit: NULLABLE_STRING_SCHEMA,
    closureType: NULLABLE_STRING_ARRAY_SCHEMA,
    isSavedToWardrobe: NULLABLE_BOOLEAN_SCHEMA,
  }),
});
const PRODUCT_RENDER_ITEM_INPUT_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  brand: NULLABLE_STRING_SCHEMA,
  description: NULLABLE_STRING_SCHEMA,
  price: z.object({
    amount: NULLABLE_PRICE_SCHEMA,
    currency: NULLABLE_STRING_SCHEMA,
    display: NULLABLE_STRING_SCHEMA,
  }),
  availability: NULLABLE_STRING_SCHEMA,
  image: NULLABLE_STRING_SCHEMA,
  audience: NULLABLE_STRING_SCHEMA,
  category: NULLABLE_STRING_SCHEMA,
  attributes: z.object({
    season: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
    formalityLevel: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
    style: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
    occasions: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
    colorBase: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
    pattern: NULLABLE_STRING_SCHEMA,
    finish: NULLABLE_STRING_SCHEMA,
    isNeutral: NULLABLE_BOOLEAN_SCHEMA,
    composition: NULLABLE_STRING_SCHEMA,
    silhouette: NULLABLE_STRING_SCHEMA,
    fit: NULLABLE_STRING_SCHEMA,
    closureType: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
    isSavedToWardrobe: NULLABLE_BOOLEAN_SCHEMA,
  }),
});
const SEARCH_OUTPUT_SCHEMA = z.object({
  resultType: z.literal("product_search"),
  count: z.number(),
  items: z.array(PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});
const FETCH_OUTPUT_SCHEMA = z.object({
  resultType: z.literal("product_fetch"),
  item: PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA,
  items: z.array(PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA),
});
type NormalizedProductItem = ProductToolCardItem &
  z.infer<typeof PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA>;
type ProductRenderInputItem = z.infer<typeof PRODUCT_RENDER_ITEM_INPUT_SCHEMA>;

function normalizeNullableStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : null;
  }

  return null;
}

function normalizeRenderProductItem(
  item: ProductRenderInputItem,
): NormalizedProductItem {
  return {
    ...item,
    url: getSafeHttpUrl(item.url),
    image: getSafeHttpUrl(item.image) || null,
    attributes: {
      ...item.attributes,
      season: normalizeNullableStringArray(item.attributes.season),
      formalityLevel: normalizeNullableStringArray(
        item.attributes.formalityLevel,
      ),
      style: normalizeNullableStringArray(item.attributes.style),
      occasions: normalizeNullableStringArray(item.attributes.occasions),
      colorBase: normalizeNullableStringArray(item.attributes.colorBase),
      closureType: normalizeNullableStringArray(item.attributes.closureType),
    },
  } as NormalizedProductItem;
}

function toTextToolResult(
  structuredContent: Record<string, unknown>,
  text: string,
  meta?: Record<string, unknown>,
) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent,
    ...(meta ? { _meta: meta } : {}),
  };
}

export function registerRenderProductGridTool(server) {
  server.registerTool(
    "render_product_grid",
    {
      description: RENDER_PRODUCT_GRID_DESCRIPTION,
      inputSchema: {
        items: z.array(PRODUCT_RENDER_ITEM_INPUT_SCHEMA),
        total: z.number().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      },
      outputSchema: SEARCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: PRODUCT_GRID_RENDER_TOOL_META,
    },
    async (args) => {
      const items = Array.isArray(args?.items)
        ? (args.items as ProductRenderInputItem[]).map(
            normalizeRenderProductItem,
          )
        : [];
      return toTextToolResult(
        {
          resultType: "product_search",
          count: items.length,
          items,
          total: Number(args?.total ?? items.length),
          offset: Number(args?.offset ?? 0),
          limit: Number(args?.limit ?? items.length),
        },
        formatProductSearchText(items),
        buildProductGridMeta(items),
      );
    },
  );
}

export function registerRenderProductDetailTool(server) {
  server.registerTool(
    "render_product_detail",
    {
      description: RENDER_PRODUCT_DETAIL_DESCRIPTION,
      inputSchema: {
        item: PRODUCT_RENDER_ITEM_INPUT_SCHEMA,
      },
      outputSchema: FETCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: PRODUCT_DETAIL_RENDER_TOOL_META,
    },
    async (args) => {
      const item = normalizeRenderProductItem(
        args?.item as ProductRenderInputItem,
      );
      return toTextToolResult(
        {
          resultType: "product_fetch",
          item,
          items: [item],
        },
        formatProductFetchText(item),
        buildProductDetailMeta(item),
      );
    },
  );
}
