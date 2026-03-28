import OpenAI from "openai";
import { getCapsuleCategories } from "./categories.js";

const DEFAULT_CHAT_MODEL = "gpt-5.2";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function buildCapsuleSchema(categories) {
  const properties = {};
  const required = [];

  for (const [category, count] of Object.entries(categories)) {
    properties[category] = {
      type: "array",
      description: `Exactly ${count} selected item ids for the ${category} category.`,
      items: {
        type: "string"
      },
      uniqueItems: true,
      minItems: count,
      maxItems: count
    };
    required.push(category);
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function buildSwimwearSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      _reasoning: {
        type: "string",
        description: "Briefly explain which bottom you matched the swimwear to and why."
      },
      swimwear: {
        type: "array",
        description: "Either one swimsuit id or two ids that form a swimwear top and bottom set.",
        items: {
          type: "string"
        },
        minItems: 1,
        maxItems: 2
      }
    },
    required: ["_reasoning", "swimwear"]
  };
}

function buildJsonObjectFormat(userProfile = null) {
  const categories = getCapsuleCategories(userProfile);
  const num_items = Object.entries(categories).reduce((sum, [, count]) => sum + count, 0)
  return {
    type: "json_schema",
    name: "capsule_wardrobe_response",
    description: "Structured capsule wardrobe selection with brief reasoning and exact category counts.",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        system_evaluation: {
          type: "object",
          additionalProperties: false,
          required: ["overall_explanation", "outfit_formulas"],
          properties: {
            overall_explanation: {
              type: "string",
              description: "Briefly explain why this capsule works well as a dense, cohesive system..."
            },
            outfit_formulas: {
              type: "array",
              description: "Provide 3-4 highly wearable outfit formulas using the selected items (reference them by basic name, not ID).",
              items: {
                type: "string"
              },
              minItems: 3,
              maxItems: 4
            }
          }
        },
        item_details: {
          type: "array",
          description: `You MUST generate exactly one object in this array for EVERY single item included in the 'capsule'. If you selected ${num_items} items, there MUST be exactly ${num_items} objects in this array.`,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "role", "reason", "compatibility", "warning"],
            properties: {
              id: {
                type: "string",
                description: "Must match candidate ID"
              },
              role: {
                type: "string",
                description: "anchor, connector, or accent",
                enum: ["anchor", "connector", "accent"]
              },
              reason: {
                type: "string",
                description: "Brief reason for selection (e.g., silhouette balance, visual harmony)"
              },
              compatibility: {
                type: "string",
                description: "Note how many/which items this pairs with"
              },
              warning: {
                type: "string",
                description: "Any styling friction or limitation (or 'None')"
              }
            }
          },
          minItems: num_items,
          maxItems: num_items
        },
        capsule: buildCapsuleSchema(categories)
      },
      required: ["system_evaluation", "item_details", "capsule"]
    },
    strict: true
  };
}

function buildCustomJsonObjectFormat(name, description, schema) {
  return {
    type: "json_schema",
    name,
    description,
    schema,
    strict: false
  };
}

let cachedClient = null;

function getOpenAiClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function splitSystemAndUserPrompt(prompt) {
  const source = String(prompt || "");
  const systemMarker = "System:";
  const userMarker = "User:";
  const systemStart = source.indexOf(systemMarker);
  const userStart = source.indexOf(userMarker);

  if (systemStart === -1 || userStart === -1 || userStart < systemStart) {
    return {
      system: "",
      user: source.trim()
    };
  }

  return {
    system: source.slice(systemStart + systemMarker.length, userStart).trim(),
    user: source.slice(userStart + userMarker.length).trim()
  };
}

function buildImageDataUrl(image) {
  const mimeType = typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
    ? image.mimeType.trim()
    : "image/png";

  if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
    return null;
  }

  return `data:${mimeType};base64,${image.buffer.toString("base64")}`;
}

function buildResponsesInput(user, images = []) {
  const content = [];
  const userText = String(user || "").trim();

  if (userText) {
    content.push({
      type: "input_text",
      text: userText
    });
  }

  for (const image of images) {
    const imageUrl = buildImageDataUrl(image);
    if (!imageUrl) {
      console.warn(
        "[openai][image-skipped]",
        JSON.stringify({
          category: image?.category ?? null,
          filename: image?.filename ?? null,
          reason: "missing_buffer"
        })
      );
      continue;
    }

    content.push({
      type: "input_image",
      image_url: imageUrl,
      detail: "high"
    });
  }

  if (content.length === 1 && content[0].type === "input_text") {
    return content[0].text;
  }

  return [
    {
      role: "user",
      content
    }
  ];
}

function releaseImageBuffers(images = []) {
  for (const image of images) {
    if (image && typeof image === "object" && "buffer" in image) {
      image.buffer = null;
    }
  }
}

function buildResponsesPayload(user, images = []) {
  const input = buildResponsesInput(user, images);
  releaseImageBuffers(images);
  return input;
}

async function getPromptEmbeddings(prompt) {
  const client = getOpenAiClient();
  const response = await client.embeddings.create({
    model: DEFAULT_EMBEDDING_MODEL,
    input: prompt,
    encoding_format: "float"
  });
  const embedding = response?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Failed to compute prompt embeddings");
  }
  return embedding;
}

async function generateJsonWithLlm(
  prompt,
  {
    userProfile = null,
    format = null,
    images = [],
    onPayloadBuilt = null
  } = {}
) {
  const client = getOpenAiClient();
  const { system, user } = splitSystemAndUserPrompt(prompt);
  const input = buildResponsesPayload(user, images);
  onPayloadBuilt?.();

  const response = await client.responses.create({
    model: DEFAULT_CHAT_MODEL,
    instructions: system || undefined,
    input,
    reasoning: {"effort": "low"},
    // temperature: 0.2,
    // top_p: 0.9,
    max_output_tokens: 10000,
    text: {
      format: format || buildJsonObjectFormat(userProfile)
    }
  });

  let content = response?.output_text || "{}";
  let json;
  if (content) {
    content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
  }
  try {
    json = JSON.parse(content);
  } catch(error) {
    const parseError = new Error(`Failed to parse JSON response: ${error.message}\nResponse content: ${content}`);
    parseError.rawSelectionText = typeof response?.output_text === "string" && response.output_text.trim().length > 0
      ? response.output_text.trim()
      : null;
    throw parseError;
  }

  return { response, json };
}

export {
  generateJsonWithLlm,
  getPromptEmbeddings,
  buildCapsuleSchema,
  buildSwimwearSchema,
  buildCustomJsonObjectFormat,
  buildImageDataUrl,
  buildResponsesInput,
  buildResponsesPayload,
  releaseImageBuffers
};
