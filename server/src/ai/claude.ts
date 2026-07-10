import Anthropic from "@anthropic-ai/sdk";
import {
  buildJsonObjectFormat,
  buildSystemPrompt,
  splitSystemAndUserPrompt,
} from "./llmPrompts.js";
import { releaseImageBuffers } from "./openai.js";
import { logWarn } from "../logger.js";
import type {
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LlmGenerateOptions,
  ParsedGenerationError,
  UserProfileLike,
} from "./types.js";
import { throwIfAborted } from "./abortSignal.js";

const DEFAULT_CHAT_MODEL = "claude-opus-4-7";
const ALLOWED_CHAT_MODELS = ["claude-opus-4-7"];

type ClaudeResponseLike = {
  content?: Array<{
    type?: string;
    text?: string | null;
    [key: string]: unknown;
  }>;
};

type ClaudeMessageContent =
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
        data: string;
      };
    }
  | { type: "text"; text: string };

type ClaudeMessagesCreatePayload = {
  model: string;
  system?: string;
  messages: Array<{
    role: "user";
    content: ClaudeMessageContent[];
  }>;
  output_config?: {
    format: {
      type: "json_schema";
      schema: JsonSchema | JsonSchema[] | unknown;
    };
  };
  max_tokens: number;
};

type ClaudeClientLike = {
  apiKey?: string;
  messages: {
    create: (
      payload: ClaudeMessagesCreatePayload,
      options?: { signal?: AbortSignal },
    ) => Promise<ClaudeResponseLike>;
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

function buildClaudeSystemPrompt(
  system = "",
  userProfile: UserProfileLike | null = null,
  systemPromptOverride: string | null = null,
) {
  const systemText = String(system || "").trim();
  const generatedSystemText =
    systemPromptOverride || buildSystemPrompt(userProfile);

  return [systemText, generatedSystemText]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

function buildClaudeMessages(user: string, images: ImageAssetLike[] = []) {
  const content: ClaudeMessageContent[] = [];
  const userText = String(user || "").trim();

  for (const image of images) {
    const imageContent = buildClaudeImageContent(image);
    if (!imageContent) {
      continue;
    }

    content.push(imageContent);
  }

  if (userText) {
    content.push({
      type: "text",
      text: userText,
    });
  }

  return [
    {
      role: "user",
      content: content.length > 0 ? content : [{ type: "text", text: "" }],
    },
  ];
}

function buildClaudeImageContent(
  image: ImageAssetLike | null | undefined,
): ClaudeMessageContent | null {
  if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
    logWarn("ai.claude.image.skipped", {
      category: image?.category ?? null,
      filename: image?.filename ?? null,
      reason: "missing_buffer",
    });
    return null;
  }

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: getClaudeImageMimeType(image),
      data: image.buffer.toString("base64"),
    },
  };
}

function getClaudeImageMimeType(
  image: ImageAssetLike,
): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
  return typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
    ? normalizeClaudeImageMimeType(image.mimeType)
    : "image/jpeg";
}

function normalizeClaudeImageMimeType(
  mimeType: string,
): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
  switch (
    String(mimeType || "")
      .trim()
      .toLowerCase()
  ) {
    case "image/png":
      return "image/png";
    case "image/gif":
      return "image/gif";
    case "image/webp":
      return "image/webp";
    case "image/jpg":
    case "image/jpeg":
    default:
      return "image/jpeg";
  }
}

function sanitizeClaudeJsonSchema(
  schema: JsonSchema | JsonSchema[] | unknown,
): JsonSchema | JsonSchema[] | unknown {
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

function buildClaudeOutputConfig(
  format: JsonSchemaFormat | null = null,
  userProfile: UserProfileLike | null = null,
) {
  const resolvedFormat = format || buildJsonObjectFormat(userProfile);
  const schema = resolvedFormat?.schema;

  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  return {
    format: {
      type: "json_schema",
      schema: sanitizeClaudeJsonSchema(schema),
    },
  };
}

function extractClaudeResponseText(
  response: {
    content?: Array<{
      type?: string;
      text?: string | null;
      [key: string]: unknown;
    }>;
  } | null = null,
) {
  if (!Array.isArray(response?.content)) {
    return "";
  }

  return response.content
    .map((part) =>
      part?.type === "text" && typeof part.text === "string" ? part.text : "",
    )
    .join("")
    .trim();
}

function parseClaudeJsonResponse(response: ClaudeResponseLike) {
  let content = extractClaudeResponseText(response) || "{}";
  if (content) {
    content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    const parseError = new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${content}`,
    ) as ParsedGenerationError;
    const rawSelectionText = extractClaudeResponseText(response);
    parseError.rawSelectionText =
      rawSelectionText.length > 0 ? rawSelectionText : null;
    throw parseError;
  }
}

function createClaudeClient({
  createClientImpl = ({ apiKey }: { apiKey: string }): ClaudeClientLike => {
    const sdkClient = new Anthropic({ apiKey, maxRetries: 0 });
    return {
      apiKey,
      messages: {
        create: (payload) =>
          sdkClient.messages
            .create(payload as Parameters<typeof sdkClient.messages.create>[0])
            .then((response) => response as ClaudeResponseLike),
      },
    };
  },
  getApiKeyImpl = () => process.env.ANTHROPIC_API_KEY,
  cache = true,
}: {
  createClientImpl?: ({ apiKey }: { apiKey: string }) => ClaudeClientLike;
  getApiKeyImpl?: () => string | undefined;
  cache?: boolean;
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

    const client = createClientImpl({ apiKey });
    if (cache) {
      localCachedClient = client;
    }

    return client;
  }

  async function generateJsonWithLlm(
    prompt: string,
    options: LlmGenerateOptions = {},
  ) {
    const {
      userProfile = null,
      format = null,
      images = [],
      systemPrompt: systemPromptOverride = null,
      onPayloadBuilt = null,
      signal = null,
    } = options;
    const client = getClaudeClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    const systemPrompt = buildClaudeSystemPrompt(
      system,
      userProfile,
      systemPromptOverride,
    );
    const messages = buildClaudeMessages(user, images);
    const outputConfig = buildClaudeOutputConfig(format, userProfile);
    releaseImageBuffers(images);
    onPayloadBuilt?.();
    throwIfAborted(signal);

    const response = await client.messages.create(
      {
        model: resolveChatModel(userProfile),
        system: systemPrompt || undefined,
        messages,
        output_config: outputConfig,
        max_tokens: 8000,
      },
      signal ? { signal } : undefined,
    );
    throwIfAborted(signal);

    const json = parseClaudeJsonResponse(response);

    return {
      response: {
        ...response,
        output_text: extractClaudeResponseText(response),
      },
      json,
    };
  }

  return {
    generateJsonWithLlm,
    getClaudeClient,
  };
}

const claudeClient = createClaudeClient();
const { generateJsonWithLlm } = claudeClient;

export {
  ALLOWED_CHAT_MODELS,
  buildClaudeMessages,
  buildClaudeOutputConfig,
  buildClaudeSystemPrompt,
  createClaudeClient,
  extractClaudeResponseText,
  generateJsonWithLlm,
  sanitizeClaudeJsonSchema,
  resolveChatModel,
};
