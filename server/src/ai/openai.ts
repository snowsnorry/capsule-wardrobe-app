import OpenAI from "openai";
import { logError, logWarn } from "../logger.js";
import {
  buildJsonObjectFormat,
  buildSystemPrompt,
  splitSystemAndUserPrompt,
} from "./llmPrompts.js";
import { resolveLlmProvider } from "./llmProviders.js";
import type {
  ImageAssetLike,
  LlmGenerateOptions,
  ParsedGenerationError,
  UserProfileLike,
} from "./types.js";
import { throwIfAborted } from "./abortSignal.js";

const DEFAULT_CHAT_MODEL = "gpt-5.5";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

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
    maxRetries: 0,
  });
  return cachedClient;
}

function buildImageDataUrl(image: ImageAssetLike) {
  const mimeType =
    typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
      ? image.mimeType.trim()
      : "image/png";

  if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
    return null;
  }

  return `data:${mimeType};base64,${image.buffer.toString("base64")}`;
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
      logWarn("ai.openai.image.skipped", {
        category: image?.category ?? null,
        filename: image?.filename ?? null,
        reason: "missing_buffer",
      });
      continue;
    }

    content.push({
      type: "input_image",
      image_url: imageUrl,
      detail: "high",
    });
  }

  if (userText) {
    content.push({
      type: "input_text",
      text: userText,
    });
  }

  if (content.length === 1 && content[0].type === "input_text") {
    return content[0].text;
  }

  return [
    {
      role: "user",
      content,
    },
  ];
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

function buildOpenAiResponsesRequest({
  format,
  input,
  systemPrompt,
  userProfile,
}) {
  const resolved = resolveLlmProvider(userProfile);
  return {
    model:
      resolved.provider === "openai" && resolved.model
        ? resolved.model
        : DEFAULT_CHAT_MODEL,
    instructions: systemPrompt || undefined,
    input,
    reasoning: { effort: "low" },
    // temperature: 0.2,
    // top_p: 0.9,
    max_output_tokens: 10000,
    text: {
      format: format || buildJsonObjectFormat(userProfile),
    },
  };
}

async function getPromptEmbeddingsWithClient(client, prompt: string) {
  const response = await client.embeddings.create({
    model: DEFAULT_EMBEDDING_MODEL,
    input: prompt,
    encoding_format: "float",
  });
  const embedding = response?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Failed to compute prompt embeddings");
  }
  return embedding;
}

async function generateJsonWithLlm(
  prompt: string,
  options: LlmGenerateOptions = {},
) {
  return generateJsonWithLlmWithClient(getOpenAiClient(), prompt, options);
}

async function generateJsonWithLlmWithClient(
  client,
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
  const { system, user } = splitSystemAndUserPrompt(prompt);
  const systemPrompt = buildOpenAiSystemPrompt(
    system,
    systemPromptOverride,
    userProfile,
  );
  const input = buildResponsesPayload(user, images);
  onPayloadBuilt?.();
  throwIfAborted(signal);
  const requestStartedAt = Date.now();
  const request = buildOpenAiResponsesRequest({
    format,
    input,
    systemPrompt,
    userProfile,
  });
  let response;

  try {
    response = await client.responses.create(
      request,
      signal ? { signal } : undefined,
    );
    throwIfAborted(signal);
  } catch (error) {
    logError("ai.openai.request.failed", error, {
      model: request.model,
      durationMs: Date.now() - requestStartedAt,
      imageCount: Array.isArray(images) ? images.length : 0,
      hasSystemPrompt: Boolean(systemPrompt),
      userChars: user.length,
    });
    throw error;
  }

  return { response, json: parseOpenAiJsonResponse(response) };
}

function buildOpenAiSystemPrompt(
  system: string,
  systemPromptOverride: string | null,
  userProfile: UserProfileLike | null,
): string {
  return [system, systemPromptOverride || buildSystemPrompt(userProfile)]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

function parseOpenAiJsonResponse(response): unknown {
  const content = String(response?.output_text || "{}")
    .replace(/^[^{]*/, "")
    .replace(/[^}]*$/, "");
  try {
    return JSON.parse(content);
  } catch (error) {
    throw buildOpenAiParseError(error, content, response?.output_text);
  }
}

function buildOpenAiParseError(
  error: unknown,
  content: string,
  outputText: unknown,
): ParsedGenerationError {
  const parseError = new Error(
    `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${content}`,
  ) as ParsedGenerationError;
  parseError.rawSelectionText =
    typeof outputText === "string" && outputText.trim().length > 0
      ? outputText.trim()
      : null;
  return parseError;
}

export {
  generateJsonWithLlm,
  buildImageDataUrl,
  buildOpenAiParseError,
  buildOpenAiSystemPrompt,
  buildResponsesInput,
  buildResponsesPayload,
  generateJsonWithLlmWithClient,
  parseOpenAiJsonResponse,
  getPromptEmbeddingsWithClient,
  releaseImageBuffers,
};
