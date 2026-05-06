import test from "node:test";
import assert from "node:assert/strict";
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
  assert.ok(Boolean(schema) && typeof schema === "object" && !Array.isArray(schema));
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

  assert.deepEqual(schema.parse({
    mood: "good",
    count: 1,
    tags: ["a"]
  }), {
    mood: "good",
    count: 1,
    tags: ["a"]
  });

  assert.throws(() => schema.parse({
    mood: "other",
    count: 1,
    tags: ["a"]
  }));
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

  assert.equal(typeof result.zodSchema.parse, "function");
  assertGeminiObjectSchema(result.responseJsonSchema);
  assert.equal(result.responseJsonSchema.type, "object");
  assert.equal(result.responseJsonSchema.additionalProperties, false);
  assert.equal(result.responseJsonSchema.properties?.ok.type, "boolean");
});
