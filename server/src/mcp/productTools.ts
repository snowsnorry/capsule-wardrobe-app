import { z } from "zod";

import {
  getSearchInputSchema,
  type SearchToolSchemaOptions,
} from "./productToolSchemas.js";
import { buildMcpImageThumbnailUrl } from "./mcpImageThumbnails.js";
import { registerStatsTool } from "./productStatsTool.js";
import { getCachedSearchSchemaOptions } from "./productSearchSchemaOptions.js";
import {
  buildProductDetailMeta,
  buildProductGridMeta,
} from "./productToolCards.js";

const SEARCH_DESCRIPTION =
  "Search the product catalog with wardrobe-relevant filters. Include optional natural-language `query` with filters for more precise matches when the desired item or style is easier to describe. Use `get_search_options` to discover valid filter values before applying filters. Prefer exact option values from `get_search_options`; do not invent filter values.";
const GET_SEARCH_OPTIONS_DESCRIPTION =
  "Return allowed filter values for product catalog search.";
const FETCH_DESCRIPTION =
  "Fetch one product by id or URL returned from MCP search.";
const DEFAULT_SEARCH_OFFSET = 0;
const DEFAULT_SEARCH_LIMIT = 20;

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

const SEARCH_OPTION_OUTPUT_SCHEMA = z.object({
  value: z.string(),
  label: z.string(),
});
const PRICE_RANGE_OUTPUT_SCHEMA = z.object({
  min: z.number(),
  max: z.number(),
});
const GET_SEARCH_OPTIONS_OUTPUT_SCHEMA = z.object({
  ok: z.boolean(),
  brands: z.array(SEARCH_OPTION_OUTPUT_SCHEMA),
  categories: STRING_ARRAY_SCHEMA,
  seasons: STRING_ARRAY_SCHEMA,
  formalityLevels: STRING_ARRAY_SCHEMA,
  styles: STRING_ARRAY_SCHEMA,
  occasions: STRING_ARRAY_SCHEMA,
  audience: STRING_ARRAY_SCHEMA,
  colors: STRING_ARRAY_SCHEMA,
  patterns: STRING_ARRAY_SCHEMA,
  silhouettes: STRING_ARRAY_SCHEMA,
  fits: STRING_ARRAY_SCHEMA,
  closureTypes: STRING_ARRAY_SCHEMA,
  priceRange: PRICE_RANGE_OUTPUT_SCHEMA,
});
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

type ProductRowLike = Record<string, unknown>;

export type ProductToolsDeps = {
  profileEmail: string;
  runSearchImpl: (
    email: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  getSearchStatsImpl: (
    email: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  getSearchOptionsImpl: (email: string) => Promise<Record<string, unknown>>;
  getProductByIdImpl: (
    id: string,
    email: string,
  ) => Promise<ProductRowLike | null>;
  getProductByUrlImpl: (
    url: string,
    email: string,
  ) => Promise<ProductRowLike | null>;
};

function toJsonToolResult(payload: Record<string, unknown>, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload),
      },
    ],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
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

function toToolError(error: "invalid_payload" | "not_found") {
  return toJsonToolResult({ ok: false, error }, true);
}

function isInvalidPayloadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "invalid_payload" ||
      (error as Error & { code?: string }).code === "invalid_payload")
  );
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function nullablePrice(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function nullableStringArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : null;
}

function getPriceDisplay(
  amount: number | string | null,
  currency: string | null,
) {
  if (amount == null) {
    return null;
  }
  return currency ? `${String(amount)} ${currency}` : String(amount);
}

function toNormalizedProduct(item: ProductRowLike) {
  const amount = nullablePrice(item.price);
  const currency = nullableString(item.currency);
  const category = nullableString(item.category);
  const availability = nullableString(item.availability);
  const season = nullableStringArray(item.season);
  const style = nullableStringArray(item.style);
  const isSavedToWardrobe = nullableBoolean(item.isSavedToWardrobe);

  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    brand: nullableString(item.brand),
    url: String(item.url || ""),
    description: nullableString(item.description),
    price: {
      amount,
      currency,
      display: getPriceDisplay(amount, currency),
    },
    availability,
    image: buildMcpImageThumbnailUrl(item.imageUrl),
    audience: nullableString(item.audience),
    category,
    attributes: {
      season,
      formalityLevel: nullableStringArray(item.formalityLevel),
      style,
      occasions: nullableStringArray(item.occasions),
      colorBase: nullableStringArray(item.colorBase),
      pattern: nullableString(item.pattern),
      finish: nullableString(item.finish),
      isNeutral: nullableBoolean(item.isNeutral),
      composition: nullableString(item.composition),
      silhouette: nullableString(item.silhouette),
      fit: nullableString(item.fit),
      closureType: nullableStringArray(item.closureType),
      isSavedToWardrobe,
    },
  };
}

function registerGetSearchOptionsTool(server, deps: ProductToolsDeps) {
  server.registerTool(
    "get_search_options",
    {
      description: GET_SEARCH_OPTIONS_DESCRIPTION,
      inputSchema: {},
      outputSchema: GET_SEARCH_OPTIONS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () => {
      const options = await deps.getSearchOptionsImpl(deps.profileEmail);
      return toJsonToolResult({
        ok: true,
        ...options,
      });
    },
  );
}

function registerSearchTool(
  server,
  deps: ProductToolsDeps,
  schemaOptions: SearchToolSchemaOptions,
) {
  server.registerTool(
    "search",
    {
      description: SEARCH_DESCRIPTION,
      inputSchema: getSearchInputSchema(schemaOptions),
      outputSchema: SEARCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      try {
        const result = await deps.runSearchImpl(deps.profileEmail, args || {});
        const items = Array.isArray(result.items)
          ? result.items.map((item) =>
              toNormalizedProduct(item as ProductRowLike),
            )
          : [];
        const output = {
          resultType: "product_search",
          count: items.length,
          items,
          total: Number(result.total || 0),
          offset: Number(result.offset ?? DEFAULT_SEARCH_OFFSET),
          limit: Number(result.limit ?? DEFAULT_SEARCH_LIMIT),
        };
        return toTextToolResult(
          output,
          `Found ${items.length} products.`,
          buildProductGridMeta(items),
        );
      } catch (error) {
        if (isInvalidPayloadError(error)) {
          return toToolError("invalid_payload");
        }
        throw error;
      }
    },
  );
}

function registerFetchTool(server, deps: ProductToolsDeps) {
  server.registerTool(
    "fetch",
    {
      description: FETCH_DESCRIPTION,
      inputSchema: {
        id: z.string().optional(),
        url: z.string().optional(),
      },
      outputSchema: FETCH_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const id = normalizeOptionalString(args?.id);
      const url = normalizeOptionalString(args?.url);
      if ((id && url) || (!id && !url) || (url && !isHttpUrl(url))) {
        return toToolError("invalid_payload");
      }

      const item = id
        ? await deps.getProductByIdImpl(id, deps.profileEmail)
        : await deps.getProductByUrlImpl(url, deps.profileEmail);

      if (!item) {
        return toToolError("not_found");
      }

      const normalizedItem = toNormalizedProduct(item);

      return toTextToolResult(
        {
          resultType: "product_fetch",
          item: normalizedItem,
          items: [normalizedItem],
        },
        `Fetched product ${normalizedItem.name}.`,
        buildProductDetailMeta(normalizedItem),
      );
    },
  );
}

export async function registerProductTools(server, deps: ProductToolsDeps) {
  const searchSchemaOptions = await getCachedSearchSchemaOptions(deps);
  registerGetSearchOptionsTool(server, deps);
  registerSearchTool(server, deps, searchSchemaOptions);
  registerStatsTool(server, deps, searchSchemaOptions);
  registerFetchTool(server, deps);
}
