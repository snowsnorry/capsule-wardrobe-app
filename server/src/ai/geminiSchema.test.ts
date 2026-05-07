import { test, expect } from "vitest";
import {
  buildGeminiStructuredOutput,
  buildZodSchemaFromJsonSchema
} from "./geminiSchema.js";

function assertGeminiObjectSchema(
  schema: unknown
): asserts schema is {
  type?: string;
  additionalProperties?: boolean;
  properties?: Record<string, { type?: string }>;
} {
  expect(Boolean(schema) && typeof schema === "object" && !Array.isArray(schema)).toBeTruthy();
}

test("buildZodSchemaFromJsonSchema supports strict objects, arrays, enums, and integers", () => {
  const schema = buildZodSchemaFromJsonSchema({
    type: "object",
    additionalProperties: false,
    properties: {
      mood: {
        type: "string",
        enum: ["good", "bad"]
      },
      count: {
        type: "integer",
        minimum: 1
      },
      tags: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: {
          type: "string"
        }
      }
    },
    required: ["mood", "count", "tags"]
  });

  expect(schema.parse({
    mood: "good",
    count: 1,
    tags: ["a"]
  })).toEqual({
    mood: "good",
    count: 1,
    tags: ["a"]
  });

  expect(() => schema.parse({
    mood: "other",
    count: 1,
    tags: ["a"]
  })).toThrow();
});

test("buildGeminiStructuredOutput converts app format to Gemini responseJsonSchema", () => {
  const result = buildGeminiStructuredOutput({
    type: "json_schema",
    name: "example_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ok: {
          type: "boolean",
          description: "Whether generation succeeded."
        }
      },
      required: ["ok"]
    }
  });

  expect(typeof result.zodSchema.parse).toBe("function");
  assertGeminiObjectSchema(result.responseJsonSchema);
  expect(result.responseJsonSchema.type).toBe("object");
  expect(result.responseJsonSchema.additionalProperties).toBe(false);
  expect(result.responseJsonSchema.properties?.ok.type).toBe("boolean");
});
