import Anthropic from "@anthropic-ai/sdk";
import {
  buildDeveloperPrompt,
  buildJsonObjectFormat,
  releaseImageBuffers,
  splitSystemAndUserPrompt
} from "./openai.js";
import type {
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LlmGenerateOptions,
  ParsedGenerationError,
  UserProfileLike
} from "./types.js";

const DEFAULT_CHAT_MODEL = "claude-opus-4-7";
const ALLOWED_CHAT_MODELS = ["claude-opus-4-7"];

type ClaudeResponseLike = {
  content?: Array<{ type?: string; text?: string | null }>;
};

type ClaudeClientLike = {
  apiKey?: string;
  messages: {
    create: (payload: Record<string, unknown>) => Promise<ClaudeResponseLike>;
  };
};

function resolveChatModel(userProfile: UserProfileLike | null = null) {
  const llm = String(userProfile?.llm || "").trim();
  if (llm.startsWith("claude:")) {
    const model = llm.slice("claude:".length).trim();
    if (ALLOWED_CHAT_MODELS.includes(model)) {
      return model;
    }
  }

  return DEFAULT_CHAT_MODEL;
}

function buildClaudeSystemPrompt(system = "", userProfile: UserProfileLike | null = null) {
  const systemText = String(system || "").trim();
  const developerText = buildDeveloperPrompt(userProfile);

  return [systemText, developerText]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

function buildClaudeMessages(user: string, images: ImageAssetLike[] = []) {
  const content: Array<
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string }
  > = [];
  const userText = String(user || "").trim();

  for (const image of images) {
    if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
      console.warn(
        "[claude][image-skipped]",
        JSON.stringify({
          category: image?.category ?? null,
          filename: image?.filename ?? null,
          reason: "missing_buffer"
        })
      );
      continue;
    }

    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
          ? image.mimeType.trim()
          : "image/jpeg",
        data: image.buffer.toString("base64")
      }
    });
  }

  if (userText) {
    content.push({
      type: "text",
      text: userText
    });
  }

  return [{
    role: "user",
    content: content.length > 0 ? content : [{ type: "text", text: "" }]
  }];
}

function sanitizeClaudeJsonSchema(schema: JsonSchema | JsonSchema[] | unknown): JsonSchema | JsonSchema[] | unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeClaudeJsonSchema(item));
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "minItems" && typeof value === "number" && value > 1) {
      normalized[key] = 1;
      continue;
    }

    if (key === "maxItems") {
      continue;
    }

    normalized[key] = sanitizeClaudeJsonSchema(value);
  }

  return normalized;
}

function buildClaudeOutputConfig(format: JsonSchemaFormat | null = null, userProfile: UserProfileLike | null = null) {
  const resolvedFormat = format || buildJsonObjectFormat(userProfile);
  const schema = resolvedFormat?.schema;

  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  return {
    format: {
      type: "json_schema",
      schema: sanitizeClaudeJsonSchema(schema)
    }
  };
}

function extractClaudeResponseText(response: { content?: Array<{ type?: string; text?: string | null }> } | null = null) {
  if (!Array.isArray(response?.content)) {
    return "";
  }

  return response.content
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function createClaudeClient({
  createClientImpl = ({ apiKey }: { apiKey: string }) => new Anthropic({ apiKey, maxRetries: 0 }),
  getApiKeyImpl = () => process.env.ANTHROPIC_API_KEY,
  cache = true
} = {}) {
  let localCachedClient = null;

  function getClaudeClient() {
    if (cache && localCachedClient) {
      return localCachedClient;
    }

    const apiKey = getApiKeyImpl();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const client = createClientImpl({ apiKey }) as ClaudeClientLike;
    if (cache) {
      localCachedClient = client;
    }

    return client;
  }

  async function generateJsonWithLlm(prompt: string, options: LlmGenerateOptions = {}) {
    const {
      userProfile = null,
      format = null,
      images = [],
      onPayloadBuilt = null
    } = options;
    const client = getClaudeClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    const systemPrompt = buildClaudeSystemPrompt(system, userProfile);
    const messages = buildClaudeMessages(user, images);
    const outputConfig = buildClaudeOutputConfig(format, userProfile);
    releaseImageBuffers(images);
    onPayloadBuilt?.();

    const response = await client.messages.create({
      model: resolveChatModel(userProfile),
      system: systemPrompt || undefined,
      messages,
      output_config: outputConfig,
      max_tokens: 8000
    });

    let content = extractClaudeResponseText(response) || "{}";
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
      const rawSelectionText = extractClaudeResponseText(response);
      parseError.rawSelectionText = rawSelectionText.length > 0 ? rawSelectionText : null;
      throw parseError;
    }

    return {
      response: {
        ...response,
        output_text: extractClaudeResponseText(response)
      },
      json
    };
  }

  return {
    generateJsonWithLlm,
    getClaudeClient
  };
}

const claudeClient = createClaudeClient();
const { generateJsonWithLlm, getClaudeClient } = claudeClient;

export {
  ALLOWED_CHAT_MODELS,
  buildClaudeMessages,
  buildClaudeOutputConfig,
  buildClaudeSystemPrompt,
  createClaudeClient,
  extractClaudeResponseText,
  generateJsonWithLlm,
  getClaudeClient,
  sanitizeClaudeJsonSchema,
  resolveChatModel
};
