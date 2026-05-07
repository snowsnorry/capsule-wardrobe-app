import { getCapsuleCategories } from "./categories.js";
import type { JsonSchema, JsonSchemaFormat, UserProfileLike } from "./types.js";

function buildCapsuleSchema(categories: Record<string, number>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [category, count] of Object.entries(categories)) {
    properties[category] = {
      type: "array",
      description: `Exactly ${count} selected item ids for the ${category} category.`,
      items: {
        type: "string",
      },
      minItems: count,
      maxItems: count,
    };
    required.push(category);
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function buildSwimwearSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      _reasoning: {
        type: "string",
        description:
          "Briefly explain which bottom you matched the swimwear to and why.",
      },
      swimwear: {
        type: "array",
        description:
          "Either one swimsuit id or two ids that form a swimwear top and bottom set.",
        items: {
          type: "string",
        },
        minItems: 1,
        maxItems: 2,
      },
    },
    required: ["_reasoning", "swimwear"],
  };
}

function buildJsonObjectFormat(
  userProfile: UserProfileLike | null = null,
): JsonSchemaFormat {
  const categories = getCapsuleCategories(userProfile);
  const num_items = Object.entries(categories).reduce(
    (sum, [, count]) => sum + count,
    0,
  );
  return {
    type: "json_schema",
    name: "capsule_wardrobe_response",
    description:
      "Structured capsule wardrobe selection with brief reasoning and exact category counts.",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        system_evaluation: buildSystemEvaluationSchema(),
        item_details: buildItemDetailsSchema(num_items),
        capsule: buildCapsuleSchema(categories),
      },
      required: ["system_evaluation", "item_details", "capsule"],
    },
    strict: true,
  };
}

function buildSystemEvaluationSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["short_capsule_name", "overall_explanation", "outfit_formulas"],
    properties: {
      short_capsule_name: {
        type: "string",
        description: "Give this capsule a short meaningful name",
      },
      overall_explanation: {
        type: "string",
        description:
          "Briefly explain why this capsule works well as a dense, cohesive system...",
      },
      outfit_formulas: {
        type: "array",
        description:
          "Provide 4-6 highly wearable outfit formulas using the selected items (reference them by basic name AND ID in [] - IMPORTANT). Every outfit formula must contain either top + bottom or dress. CRITICAL: Every single ID mentioned here MUST explicitly exist in the final 'capsule' object below. Do NOT invent IDs.",
        items: { type: "string" },
        minItems: 4,
        maxItems: 6,
      },
    },
  };
}

function buildItemDetailsSchema(num_items: number): JsonSchema {
  return {
    type: "array",
    description: `You MUST generate exactly one object in this array for EVERY single item included in the 'capsule'. If you selected ${num_items} items, there MUST be exactly ${num_items} objects in this array.`,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["id", "role", "reason", "compatibility", "warning"],
      properties: {
        id: {
          type: "string",
          description:
            "CRITICAL: This MUST exactly match a selected candidate ID that is present in the final 'capsule' object. Do not hallucinate IDs.",
        },
        role: {
          type: "string",
          description: "key, basic, or accent",
          enum: ["key", "basic", "accent"],
        },
        reason: {
          type: "string",
          description:
            "Brief reason for selection (e.g., silhouette balance, visual harmony)",
        },
        compatibility: {
          type: "string",
          description:
            "Note how many/which items this pairs with - the exact IDs of other items IN THE CAPSULE this pairs with. Do NOT reference IDs that are not in your final selection.",
        },
        warning: {
          type: "string",
          description: "Any styling friction or limitation (or 'None')",
        },
      },
    },
    minItems: num_items,
    maxItems: num_items,
  };
}

function buildCustomJsonObjectFormat(
  name: string,
  description: string,
  schema: JsonSchema,
): JsonSchemaFormat {
  return {
    type: "json_schema",
    name,
    description,
    schema,
    strict: false,
  };
}

export {
  buildCapsuleSchema,
  buildCustomJsonObjectFormat,
  buildJsonObjectFormat,
  buildSwimwearSchema,
};
