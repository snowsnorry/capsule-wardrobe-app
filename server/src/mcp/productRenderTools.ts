import { z } from "zod";

import {
  PRODUCT_DETAIL_WIDGET_RESOURCE_LINK,
  PRODUCT_DETAIL_WIDGET_URI,
  PRODUCT_GRID_WIDGET_RESOURCE_LINK,
  PRODUCT_GRID_WIDGET_URI,
  type WidgetResourceLink,
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
const NULLABLE_BOOLEAN_SCHEMA = z.boolean().nullable();
const NULLABLE_PRICE_SCHEMA = z.union([z.number(), z.string()]).nullable();
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const RENDER_PRODUCT_GRID_DESCRIPTION =
  "Render product search results returned by `search` for clients that support MCP app resource links or OpenAI output templates. The result also includes markdown image links as a fallback.";
const RENDER_PRODUCT_DETAIL_DESCRIPTION =
  "Render a product returned by `fetch` for clients that support MCP app resource links or OpenAI output templates. The result also includes a markdown image link as a fallback.";
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

function toTextToolResult(
  structuredContent: Record<string, unknown>,
  text: string,
  resourceLink: WidgetResourceLink,
  meta?: Record<string, unknown>,
) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
      resourceLink,
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
        items: z.array(PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA),
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
        ? (args.items as NormalizedProductItem[])
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
        PRODUCT_GRID_WIDGET_RESOURCE_LINK,
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
        item: PRODUCT_SEARCH_PREVIEW_OUTPUT_SCHEMA,
      },
      outputSchema: FETCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: PRODUCT_DETAIL_RENDER_TOOL_META,
    },
    async (args) => {
      const item = args?.item as NormalizedProductItem;
      return toTextToolResult(
        {
          resultType: "product_fetch",
          item,
          items: [item],
        },
        formatProductFetchText(item),
        PRODUCT_DETAIL_WIDGET_RESOURCE_LINK,
        buildProductDetailMeta(item),
      );
    },
  );
}
