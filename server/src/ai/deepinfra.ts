import OpenAI from "openai";
import { buildSystemPrompt, splitSystemAndUserPrompt } from "./llm.js";
import { buildImageDataUrl, releaseImageBuffers } from "./openai.js";
import type { ImageAssetLike, LlmGenerateOptions, ParsedGenerationError, UserProfileLike } from "./types.js";

const OPENAI_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEFAULT_CHAT_MODEL = "google/gemma-4-31B-it";
const DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-300m";
const ALLOWED_CHAT_MODELS = [
  "google/gemma-4-31B-it",
  "Qwen/Qwen3-VL-235B-A22B-Instruct"
];
let cachedClient = null;

type DeepInfraEmbeddingsClient = {
  create: (payload: { model: string; input: string }) => Promise<{ data?: Array<{ embedding?: number[] }> }>;
};

type DeepInfraChatMessageContent =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

type DeepInfraChatCompletionPayload = {
  model: string;
  messages: Array<
    | { role: "system"; content: string }
    | { role: "user"; content: DeepInfraChatMessageContent[] }
  >;
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  response_format: { type: "json_object" };
  stream: true;
};

type DeepInfraChatCompletionsClient = {
  create: (payload: DeepInfraChatCompletionPayload) => Promise<AsyncIterable<unknown>>;
};

type DeepInfraClientLike = {
  embeddings: DeepInfraEmbeddingsClient;
  chat: {
    completions: DeepInfraChatCompletionsClient;
  };
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
};

function createDeepInfraClient({
  createClientImpl = ({
    apiKey,
    baseURL,
    maxRetries
  }: {
    apiKey: string;
    baseURL: string;
    maxRetries: number;
  }): DeepInfraClientLike => {
    const sdkClient = new OpenAI({ apiKey, baseURL, maxRetries });
    return {
      apiKey,
      baseURL,
      maxRetries,
      embeddings: {
        create: (payload) => sdkClient.embeddings.create(payload as Parameters<typeof sdkClient.embeddings.create>[0])
      },
      chat: {
        completions: {
          create: (payload) =>
            sdkClient.chat.completions.create(payload as Parameters<typeof sdkClient.chat.completions.create>[0])
              .then((response) => response as AsyncIterable<unknown>)
        }
      }
    };
  },
  getApiKeyImpl = () => process.env.DEEPINFRA_API_KEY,
  cache = true,
  nowImpl = () => Date.now(),
  warnImpl = (...args) => console.warn(...args)
}: {
  createClientImpl?: ({ apiKey, baseURL, maxRetries }: { apiKey: string; baseURL: string; maxRetries: number }) => DeepInfraClientLike;
  getApiKeyImpl?: () => string | undefined;
  cache?: boolean;
  nowImpl?: () => number;
  warnImpl?: (...args: unknown[]) => void;
} = {}) {
  let localCachedClient = null;

  function getOpenAiClient() {
    if (cache && localCachedClient) {
      return localCachedClient;
    }

    const apiKey = getApiKeyImpl();
    if (!apiKey) {
      throw new Error("DEEPINFRA_API_KEY is not set");
    }

    const client = createClientImpl({
      apiKey,
      baseURL: OPENAI_BASE_URL,
      maxRetries: 0
    });

    if (cache) {
      localCachedClient = client;
      cachedClient = client;
    }

    return client;
  }

  async function getPromptEmbeddings(prompt: string) {
    const client = getOpenAiClient();
    const response = await client.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: prompt
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
      systemPrompt: systemPromptOverride = null,
      onPayloadBuilt = null
    } = options;
    const client = getOpenAiClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    void format;
    const messages = buildChatMessages(user, images);
    const systemPrompt = [system, systemPromptOverride || buildSystemPrompt(userProfile)]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join("\n\n");
    const model = resolveChatModel(userProfile);
    const payload = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: messages }
      ],
      temperature: 0.2,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 10000,
      response_format: { type: "json_object" }
    };
    const payloadBytes = estimateJsonByteLength(payload);
    const requestStartedAt = nowImpl();
    releaseImageBuffers(images);
    onPayloadBuilt?.();
    let stream;
    try {
      stream = await client.chat.completions.create({
        ...payload,
        stream: true
      });
    } catch (error) {
      const requestError = error as {
        status?: number;
        request_id?: string;
        code?: string;
        type?: string;
        cause?: { name?: string; message?: string; code?: string; errno?: string | number };
      };
      warnImpl(
        "[deepinfra][request-failed]",
        JSON.stringify({
          model,
          durationMs: Math.max(0, nowImpl() - requestStartedAt),
          imageCount: Array.isArray(images) ? images.length : 0,
          payloadBytes,
          status: requestError.status,
          requestId: requestError.request_id,
          code: requestError.code,
          type: requestError.type,
          causeName: requestError.cause?.name ?? null,
          causeMessage: requestError.cause?.message ?? null,
          causeCode: requestError.cause?.code ?? null,
          causeErrno: requestError.cause?.errno ?? null
        })
      );
      throw error;
    }

    const content = await collectStreamText(stream);
    const response = {
      choices: [{
        message: {
          content
        }
      }],
      output_text: content
    };
    let json;
    let normalizedContent = content;
    if (normalizedContent) {
      normalizedContent = normalizedContent.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
    }
    try {
      json = JSON.parse(normalizedContent);
    } catch (error) {
      const parseError = new Error(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${normalizedContent}`
      ) as ParsedGenerationError;
      parseError.rawSelectionText = typeof content === "string" && content.trim().length > 0
        ? content.trim()
        : null;
      throw parseError;
    }

    return {
      response,
      json
    };
  }

  return {
    generateJsonWithLlm,
    getOpenAiClient,
    getPromptEmbeddings
  };
}

function estimateJsonByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
}

function resolveChatModel(userProfile: UserProfileLike | null = null) {
  const llm = String(userProfile?.llm || "").trim();
  if (llm.startsWith("deepinfra:")) {
    const model = llm.slice("deepinfra:".length).trim();
    if (ALLOWED_CHAT_MODELS.includes(model)) {
      return model;
    }
  }

  return DEFAULT_CHAT_MODEL;
}

function buildChatMessages(user: string, images: ImageAssetLike[] = []) {
  const content: Array<
    | { type: "image_url"; image_url: { url: string } }
    | { type: "text"; text: string }
  > = [];
  const userText = String(user || "").trim();

  for (const image of images) {
    const imageUrl = buildImageDataUrl(image);
    if (!imageUrl) {
      console.warn(
        "[deepinfra][image-skipped]",
        JSON.stringify({
          category: image?.category ?? null,
          filename: image?.filename ?? null,
          reason: "missing_buffer"
        })
      );
      continue;
    }

    content.push({
      type: "image_url",
      image_url: {
        url: imageUrl
      }
    });
  }

  if (userText) {
    content.push({
      type: "text",
      text: userText
    });
  }

  return content.length > 0 ? content : [{ type: "text", text: "" }];
}

function extractResponseText(response: {
  choices?: Array<{ message?: { content?: string | Array<string | { text?: string | null }> } }>;
} | null = null) {
  const content = response?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "{}";
}

async function collectStreamText(stream: AsyncIterable<unknown>) {
  let content = "";

  for await (const chunk of stream) {
    content += extractChunkText(chunk);
  }

  return content;
}

function extractChunkText(chunk: {
  choices?: Array<{ delta?: { content?: string | Array<string | { text?: string | null }> } }>;
} | null = null) {
  const delta = chunk?.choices?.[0]?.delta;
  const content = delta?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

const deepInfraClient = createDeepInfraClient();
const {
  generateJsonWithLlm,
  getOpenAiClient,
  getPromptEmbeddings
} = deepInfraClient;

export {
  createDeepInfraClient,
  ALLOWED_CHAT_MODELS,
  buildChatMessages,
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  extractResponseText,
  generateJsonWithLlm,
  getOpenAiClient,
  getPromptEmbeddings,
  resolveChatModel
};
