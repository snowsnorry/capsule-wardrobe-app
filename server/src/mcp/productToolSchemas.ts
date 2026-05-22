import { z } from "zod";

import type { SearchSchemaOptions } from "./productSearchSchemaOptions.js";

const STRING_ARRAY_SCHEMA = z.array(z.string());

export type SearchToolSchemaOptions = SearchSchemaOptions;

function stringEnumArraySchema(values: readonly string[]) {
  return z.array(z.enum(values as [string, ...string[]])).optional();
}

export function getSearchFilterInputSchema(
  schemaOptions: SearchToolSchemaOptions,
) {
  return {
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
  };
}

export function getSearchInputSchema(schemaOptions: SearchToolSchemaOptions) {
  return {
    query: z.string().optional(),
    ...getSearchFilterInputSchema(schemaOptions),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
  };
}
