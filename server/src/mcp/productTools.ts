import { z } from "zod";

import {
  getCachedSearchSchemaOptions,
  type SearchSchemaOptions,
} from "./productSearchSchemaOptions.js";

const SEARCH_DESCRIPTION =
  "Search the product catalog with wardrobe-relevant filters. `query` is optional. Use `get_search_options` to discover valid filter values before applying filters. Prefer exact option values from `get_search_options`; do not invent filter values.";
const GET_SEARCH_OPTIONS_DESCRIPTION =
  "Return allowed filter values for product catalog search.";
const FETCH_DESCRIPTION =
  "Fetch one product by id or URL returned from MCP search.";
const DEFAULT_SEARCH_OFFSET = 0;
const DEFAULT_SEARCH_LIMIT = 20;

const STRING_ARRAY_SCHEMA = z.array(z.string());

type ProductRowLike = Record<string, unknown>;

type ProductToolsDeps = {
  profileEmail: string;
  runSearchImpl: (
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

function toProductSearchPreview(item: ProductRowLike) {
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    url: String(item.url || ""),
    brand: nullableString(item.brand),
    price: nullablePrice(item.price),
    currency: nullableString(item.currency),
    imageUrl: nullableString(item.imageUrl),
    category: nullableString(item.category),
    colorBase: nullableStringArray(item.colorBase),
    season: nullableStringArray(item.season),
    style: nullableStringArray(item.style),
    formalityLevel: nullableStringArray(item.formalityLevel),
    isSavedToWardrobe: nullableBoolean(item.isSavedToWardrobe),
  };
}

function toProductDetail(item: ProductRowLike) {
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    url: String(item.url || ""),
    description: nullableString(item.description),
    brand: nullableString(item.brand),
    price: nullablePrice(item.price),
    currency: nullableString(item.currency),
    availability: nullableString(item.availability),
    imageUrl: nullableString(item.imageUrl),
    audience: nullableString(item.audience),
    category: nullableString(item.category),
    season: nullableStringArray(item.season),
    formalityLevel: nullableStringArray(item.formalityLevel),
    style: nullableStringArray(item.style),
    occasions: nullableStringArray(item.occasions),
    colorBase: nullableStringArray(item.colorBase),
    pattern: nullableString(item.pattern),
    finish: nullableString(item.finish),
    isNeutral: nullableBoolean(item.isNeutral),
    composition: nullableString(item.composition),
    silhouette: nullableString(item.silhouette),
    fit: nullableString(item.fit),
    closureType: nullableStringArray(item.closureType),
    isSavedToWardrobe: nullableBoolean(item.isSavedToWardrobe),
  };
}

function stringEnumArraySchema(values: readonly string[]) {
  return z.array(z.enum(values as [string, ...string[]])).optional();
}

function getSearchInputSchema(schemaOptions: SearchSchemaOptions) {
  return {
    query: z.string().optional(),
    brand: STRING_ARRAY_SCHEMA.optional(),
    priceMin: z.number().nullable().optional(),
    priceMax: z.number().nullable().optional(),
    audience: stringEnumArraySchema(schemaOptions.audience),
    category: stringEnumArraySchema(schemaOptions.category),
    season: stringEnumArraySchema(schemaOptions.season),
    formalityLevel: stringEnumArraySchema(schemaOptions.formalityLevel),
    style: stringEnumArraySchema(schemaOptions.style),
    occasions: stringEnumArraySchema(schemaOptions.occasions),
    color: stringEnumArraySchema(schemaOptions.color),
    pattern: stringEnumArraySchema(schemaOptions.pattern),
    silhouette: stringEnumArraySchema(schemaOptions.silhouette),
    fit: stringEnumArraySchema(schemaOptions.fit),
    closureType: stringEnumArraySchema(schemaOptions.closureType),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
  };
}

function registerGetSearchOptionsTool(server, deps: ProductToolsDeps) {
  server.registerTool(
    "get_search_options",
    {
      description: GET_SEARCH_OPTIONS_DESCRIPTION,
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
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
  schemaOptions: SearchSchemaOptions,
) {
  server.registerTool(
    "search",
    {
      description: SEARCH_DESCRIPTION,
      inputSchema: getSearchInputSchema(schemaOptions),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      try {
        const result = await deps.runSearchImpl(deps.profileEmail, args || {});
        const items = Array.isArray(result.items)
          ? result.items.map((item) =>
              toProductSearchPreview(item as ProductRowLike),
            )
          : [];
        const output = {
          ok: true,
          items,
          total: Number(result.total || 0),
          offset: Number(result.offset ?? DEFAULT_SEARCH_OFFSET),
          limit: Number(result.limit ?? DEFAULT_SEARCH_LIMIT),
        };
        return toJsonToolResult(output);
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
      annotations: { readOnlyHint: true, idempotentHint: true },
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

      return toJsonToolResult({
        ok: true,
        item: toProductDetail(item),
      });
    },
  );
}

export async function registerProductTools(server, deps: ProductToolsDeps) {
  const searchSchemaOptions = await getCachedSearchSchemaOptions(deps);
  registerGetSearchOptionsTool(server, deps);
  registerSearchTool(server, deps, searchSchemaOptions);
  registerFetchTool(server, deps);
}
