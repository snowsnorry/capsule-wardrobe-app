import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { getCapsuleCategories } from "./categories.js";
import type {
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LlmGenerateOptions,
  ParsedGenerationError,
  UserProfileLike
} from "./types.js";

const DEFAULT_CHAT_MODEL = "gpt-5.2";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const SYSTEM_PROMPT_TEMPLATE = readFileSync(new URL("../templates/system_prompt.txt", import.meta.url), "utf8");
const SYSTEM_PROMPT_PARTS = JSON.parse(
  readFileSync(new URL("../templates/system_prompt_parts.json", import.meta.url), "utf8")
) as Record<string, unknown>;

function buildCapsuleSchema(categories: Record<string, number>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [category, count] of Object.entries(categories)) {
    properties[category] = {
      type: "array",
      description: `Exactly ${count} selected item ids for the ${category} category.`,
      items: {
        type: "string"
      },
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

function buildSwimwearSchema(): JsonSchema {
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

function buildJsonObjectFormat(userProfile: UserProfileLike | null = null): JsonSchemaFormat {
  const categories = getCapsuleCategories(userProfile);
  const num_items = Object.entries(categories).reduce((sum, [, count]) => sum + count, 0);
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
          required: ["short_capsule_name", "overall_explanation", "outfit_formulas"],
          properties: {
            short_capsule_name: {
              type: "string",
              description: "Give this capsule a short meaningful name"
            },
            overall_explanation: {
              type: "string",
              description: "Briefly explain why this capsule works well as a dense, cohesive system..."
            },
            outfit_formulas: {
              type: "array",
              description: "Provide 4-6 highly wearable outfit formulas using the selected items (reference them by basic name AND ID in [] - IMPORTANT). Every outfit formula must contain either top + bottom or dress.",
              items: {
                type: "string"
              },
              minItems: 4,
              maxItems: 6
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
                description: "key, basic, or accent",
                enum: ["key", "basic", "accent"]
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

function buildCustomJsonObjectFormat(name: string, description: string, schema: JsonSchema): JsonSchemaFormat {
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

  cachedClient = new OpenAI({
    apiKey,
    timeout: 3 * 1000 * 60,
    maxRetries: 0
  });
  return cachedClient;
}

function splitSystemAndUserPrompt(prompt: string) {
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

function buildImageDataUrl(image: ImageAssetLike) {
  const mimeType = typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
    ? image.mimeType.trim()
    : "image/png";

  if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
    return null;
  }

  return `data:${mimeType};base64,${image.buffer.toString("base64")}`;
}

function normalizeSystemPromptKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSystemPromptAudience(value: unknown) {
  const normalized = normalizeSystemPromptKey(value);
  if (normalized === "woman" || normalized === "man") {
    return normalized;
  }
  return "not important";
}

function normalizeSystemPromptSectionContent(content: unknown) {
  if (Array.isArray(content)) {
    return content
      .filter((line) => typeof line === "string" && line.trim().length > 0)
      .join("\n")
      .trim();
  }

  return typeof content === "string" ? content.trim() : "";
}

function normalizeSystemPromptSeasonList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((season) => normalizeSystemPromptKey(season))
      .filter(Boolean);
  }

  const normalized = normalizeSystemPromptKey(value);
  return normalized ? [normalized] : [];
}

function renderSeasonalityLogicContent(entry: unknown, userProfile: UserProfileLike | null = null) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const normalizedEntry = entry as Record<string, unknown>;

  const seasons = new Set(normalizeSystemPromptSeasonList(userProfile?.season));
  const lines = [];

  if (seasons.has("summer") && typeof normalizedEntry.summer === "string") {
    lines.push(normalizedEntry.summer);
  }

  if ((seasons.has("spring") || seasons.has("autumn")) && typeof normalizedEntry.spring_autumn === "string") {
    lines.push(normalizedEntry.spring_autumn);
  }

  if (seasons.has("winter") && typeof normalizedEntry.winter === "string") {
    lines.push(normalizedEntry.winter);
  }

  return lines.join("\n").trim();
}

function renderStyleLibraryContent(entry: unknown, userProfile: UserProfileLike | null = null) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const normalizedEntry = entry as Record<string, unknown>;
  const audienceConfig = normalizedEntry.audience as Record<string, unknown> | undefined;
  const formalityConfig = normalizedEntry.formality_level as Record<string, unknown> | undefined;
  const occasionsConfig = normalizedEntry.occasions as Record<string, unknown> | undefined;
  const template = typeof normalizedEntry.template === "string" ? normalizedEntry.template : "";
  if (!template) {
    return "";
  }

  const audienceKey = normalizeSystemPromptAudience(userProfile?.audience);
  const formalityLevelKey = normalizeSystemPromptKey(userProfile?.formalityLevel);
  const occasions = Array.isArray(userProfile?.occasions) ? userProfile.occasions : [];
  const replacements = {
    audience: typeof audienceConfig?.[audienceKey] === "string"
      ? audienceConfig[audienceKey]
      : "",
    formality_level: typeof formalityConfig?.[formalityLevelKey] === "string"
      ? formalityConfig[formalityLevelKey]
      : "",
    occasions: occasions
      .map((occasion) => normalizeSystemPromptKey(occasion))
      .map((occasionKey) => occasionsConfig?.[occasionKey])
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")
  };

  let content = template;
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderSystemPromptSection(title: string, content: unknown, intro = "") {
  const normalizedContent = normalizeSystemPromptSectionContent(content);
  if (!normalizedContent) {
    return "";
  }

  return [title, intro.trim(), normalizedContent].filter(Boolean).join("\n\n");
}

function buildSystemPrompt(userProfile: UserProfileLike | null = null) {
  const styleKey = normalizeSystemPromptKey(userProfile?.style);
  const accentColorKey = normalizeSystemPromptKey(userProfile?.color);
  const audienceKey = normalizeSystemPromptAudience(userProfile?.audience);
  const formalityLevelKey = normalizeSystemPromptKey(userProfile?.formalityLevel);
  const replacements = {
    audience_logic_block: normalizeSystemPromptSectionContent(
      SYSTEM_PROMPT_PARTS.audience_logic?.[audienceKey]
    ),
    formality_logic_block: normalizeSystemPromptSectionContent(
      SYSTEM_PROMPT_PARTS.formality_logic?.[formalityLevelKey]
    ),
    seasonality_logic_block: renderSeasonalityLogicContent(
      SYSTEM_PROMPT_PARTS.seasonality_logic,
      userProfile
    ),
    style_library_block: renderSystemPromptSection(
      "STYLE LIBRARY",
      renderStyleLibraryContent(SYSTEM_PROMPT_PARTS.style_library?.[styleKey], userProfile)
    ),
    style_palette_block: renderSystemPromptSection(
      "PALETTE REFERENCE BY STYLE",
      SYSTEM_PROMPT_PARTS.palette_by_style?.[styleKey],
      "Use these as preferred defaults when no better user constraint overrides them."
    ),
    accent_color_palette_block: renderSystemPromptSection(
      "PALETTE REFERENCE BY ACCENT COLOR",
      SYSTEM_PROMPT_PARTS.palette_by_accent_color?.[accentColorKey],
      "If the user specifies an accent color, you may use these defaults:"
    )
  };

  let prompt = SYSTEM_PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  const unresolvedTokens = prompt.match(/\{\{[a-zA-Z0-9_]+\}\}/g);
  if (unresolvedTokens?.length) {
    throw new Error(`Unresolved system prompt placeholders: ${unresolvedTokens.join(", ")}`);
  }

  return prompt
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildResponsesInput(user: string, images: ImageAssetLike[] = []) {
  const content: Array<
    | { type: "input_image"; image_url: string; detail: "high" }
    | { type: "input_text"; text: string }
  > = [];
  const userText = String(user || "").trim();

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

  if (userText) {
    content.push({
      type: "input_text",
      text: userText
    });
  }

  if (content.length === 1 && content[0].type === "input_text") {
    return content[0].text;
  }

  return [{
    role: "user",
    content
  }];
}

function releaseImageBuffers(images: ImageAssetLike[] = []) {
  for (const image of images) {
    if (image && typeof image === "object" && "buffer" in image) {
      image.buffer = null;
    }
  }
}

function buildResponsesPayload(user: string, images: ImageAssetLike[] = []) {
  const input = buildResponsesInput(user, images);
  releaseImageBuffers(images);
  return input;
}

async function getPromptEmbeddings(prompt: string) {
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

async function generateJsonWithLlm(prompt: string, options: LlmGenerateOptions = {}) {
  const {
    userProfile = null,
    format = null,
    images = [],
    onPayloadBuilt = null
  } = options;
  const client = getOpenAiClient();
  const { system, user } = splitSystemAndUserPrompt(prompt);
  const systemPrompt = [system, buildSystemPrompt(userProfile)]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
  const input = buildResponsesPayload(user, images);
  onPayloadBuilt?.();
  const requestStartedAt = Date.now();
  let response;

  try {
    response = await client.responses.create({
      model: DEFAULT_CHAT_MODEL,
      instructions: systemPrompt || undefined,
      input,
      reasoning: {"effort": "low"},
      // temperature: 0.2,
      // top_p: 0.9,
      max_output_tokens: 10000,
      text: {
        format: format || buildJsonObjectFormat(userProfile)
      }
    });
  } catch (error) {
    console.error(
      "[openai][request-failed]",
      JSON.stringify({
        model: DEFAULT_CHAT_MODEL,
        durationMs: Date.now() - requestStartedAt,
        imageCount: Array.isArray(images) ? images.length : 0,
        hasSystemPrompt: Boolean(systemPrompt),
        userChars: user.length
      }),
      error
    );
    throw error;
  }

  let content = response?.output_text || "{}";
  let json;
  if (content) {
    content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
  }
  try {
    json = JSON.parse(content);
  } catch (error) {
    const parseError = new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${content}`
    ) as ParsedGenerationError;
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
  buildJsonObjectFormat,
  buildImageDataUrl,
  buildSystemPrompt,
  buildResponsesInput,
  buildResponsesPayload,
  renderStyleLibraryContent,
  splitSystemAndUserPrompt,
  releaseImageBuffers
};
