import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { buildJsonObjectFormat } from "./llmPrompts.js";
import type { JsonSchema, JsonSchemaFormat, UserProfileLike } from "./types.js";

function buildEnumZodSchema(schema: JsonSchema) {
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter((value): value is string => typeof value === "string")
    : [];

  return enumValues.length > 0
    ? z.enum(enumValues as [string, ...string[]])
    : z.string();
}

function buildObjectZodSchema(schema: JsonSchema) {
  const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const shape = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      const propertySchema = buildZodSchemaFromJsonSchema(value);
      return [key, required.has(key) ? propertySchema : propertySchema.optional()];
    })
  );
  const zodSchema = z.object(shape);
  return schema.additionalProperties === false ? zodSchema.strict() : zodSchema;
}

function buildArrayZodSchema(schema: JsonSchema) {
  let zodSchema = z.array(buildZodSchemaFromJsonSchema(schema.items));
  if (typeof schema.minItems === "number") {
    zodSchema = zodSchema.min(schema.minItems);
  }
  if (typeof schema.maxItems === "number") {
    zodSchema = zodSchema.max(schema.maxItems);
  }
  return zodSchema;
}

function buildNumberZodSchema(schema: JsonSchema, integer = false) {
  let zodSchema = integer ? z.number().int() : z.number();
  if (typeof schema.minimum === "number") {
    zodSchema = zodSchema.min(schema.minimum);
  }
  if (typeof schema.maximum === "number") {
    zodSchema = zodSchema.max(schema.maximum);
  }
  return zodSchema;
}

function describeZodSchema(zodSchema: z.ZodTypeAny, schema: JsonSchema) {
  const description = typeof schema.description === "string" && schema.description.trim().length > 0
    ? schema.description.trim()
    : typeof schema.title === "string" && schema.title.trim().length > 0
      ? schema.title.trim()
      : null;

  return description ? zodSchema.describe(description) : zodSchema;
}

function buildNonNullableZodSchema(schema: JsonSchema, nonNullType: unknown) {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return buildEnumZodSchema(schema);
  }

  switch (nonNullType) {
    case "object":
      return buildObjectZodSchema(schema);
    case "array":
      return buildArrayZodSchema(schema);
    case "integer":
      return buildNumberZodSchema(schema, true);
    case "number":
      return buildNumberZodSchema(schema);
    case "boolean":
      return z.boolean();
    case "string":
    default:
      return z.string();
  }
}

function buildZodSchemaFromJsonSchema(schema: JsonSchema | undefined | null): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") {
    return z.any();
  }

  const type = Array.isArray(schema.type) ? schema.type : [schema.type];
  const supportsNull = type.includes("null");
  const nonNullType = type.find((value) => value !== "null");
  const zodSchema = describeZodSchema(buildNonNullableZodSchema(schema, nonNullType), schema);

  return supportsNull ? zodSchema.nullable() : zodSchema;
}

function buildGeminiStructuredOutput(format: JsonSchemaFormat | null = null, userProfile: UserProfileLike | null = null) {
  const resolvedFormat = format || buildJsonObjectFormat(userProfile);
  const zodSchema = buildZodSchemaFromJsonSchema(resolvedFormat?.schema);

  return {
    zodSchema,
    responseJsonSchema: zodToJsonSchema(zodSchema)
  };
}

export {
  buildGeminiStructuredOutput,
  buildZodSchemaFromJsonSchema
};
