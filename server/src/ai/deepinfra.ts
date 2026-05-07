import OpenAI from "openai";
import { buildSystemPrompt, splitSystemAndUserPrompt } from "./llmPrompts.js";
import { buildImageDataUrl, releaseImageBuffers } from "./openai.js";
import {
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  extractResponseText,
  parseDeepInfraJsonResponse,
} from "./deepinfraResponse.js";
import type {
  ImageAssetLike,
  LlmGenerateOptions,
  UserProfileLike,
} from "./types.js";
import { logWarn } from "../logger.js";

const OPENAI_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEFAULT_CHAT_MODEL = "google/gemma-4-31B-it";
const DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-300m";
const ALLOWED_CHAT_MODELS = [
  "google/gemma-4-31B-it",
  "Qwen/Qwen3-VL-235B-A22B-Instruct",
];
type DeepInfraEmbeddingsClient = {
  create: (payload: {
    model: string;
    input: string;
  }) => Promise<{ data?: Array<{ embedding?: number[] }> }>;
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
  create: (
    payload: DeepInfraChatCompletionPayload,
  ) => Promise<AsyncIterable<unknown>>;
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

type DeepInfraRequestLogContext = {
  error: unknown;
  model: string;
  requestStartedAt: number;
  imageCount: number;
  payloadBytes: number | null;
  nowImpl: () => number;
  warnImpl: (...args: unknown[]) => void;
};

function buildDeepInfraSystemPrompt({
  system,
  systemPromptOverride,
  userProfile,
}: {
  system: string;
  systemPromptOverride: string | null;
  userProfile: UserProfileLike | null;
}) {
  return [system, systemPromptOverride || buildSystemPrompt(userProfile)]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

function buildDeepInfraPayload({
  model,
  systemPrompt,
  messages,
}: {
  model: string;
  systemPrompt: string;
  messages: DeepInfraChatMessageContent[];
}) {
  return {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: messages },
    ],
    temperature: 0.2,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 10000,
    response_format: { type: "json_object" },
  };
}

function logDeepInfraRequestFailure({
  error,
  model,
  requestStartedAt,
  imageCount,
  payloadBytes,
  nowImpl,
  warnImpl,
}: DeepInfraRequestLogContext) {
  const requestError = error as {
    status?: number;
    request_id?: string;
    code?: string;
    type?: string;
    cause?: {
      name?: string;
      message?: string;
      code?: string;
      errno?: string | number;
    };
  };
  warnImpl(
    "[deepinfra][request-failed]",
    JSON.stringify({
      model,
      durationMs: Math.max(0, nowImpl() - requestStartedAt),
      imageCount,
      payloadBytes,
      status: requestError.status,
      requestId: requestError.request_id,
      code: requestError.code,
      type: requestError.type,
      causeName: requestError.cause?.name ?? null,
      causeMessage: requestError.cause?.message ?? null,
      causeCode: requestError.cause?.code ?? null,
      causeErrno: requestError.cause?.errno ?? null,
    }),
  );
}

function createSdkDeepInfraClient({
  apiKey,
  baseURL,
  maxRetries,
}: {
  apiKey: string;
  baseURL: string;
  maxRetries: number;
}): DeepInfraClientLike {
  const sdkClient = new OpenAI({ apiKey, baseURL, maxRetries });
  return {
    apiKey,
    baseURL,
    maxRetries,
    embeddings: {
      create: (payload) =>
        sdkClient.embeddings.create(
          payload as Parameters<typeof sdkClient.embeddings.create>[0],
        ),
    },
    chat: {
      completions: {
        create: (payload) =>
          sdkClient.chat.completions
            .create(
              payload as Parameters<
                typeof sdkClient.chat.completions.create
              >[0],
            )
            .then((response) => response as AsyncIterable<unknown>),
      },
    },
  };
}

function createPromptEmbeddingsGetter(
  getOpenAiClient: () => DeepInfraClientLike,
) {
  return async function getPromptEmbeddings(prompt: string) {
    const client = getOpenAiClient();
    const response = await client.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: prompt,
    });
    const embedding = response?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to compute prompt embeddings");
    }
    return embedding;
  };
}

function createDeepInfraClient({
  createClientImpl = createSdkDeepInfraClient,
  getApiKeyImpl = () => process.env.DEEPINFRA_API_KEY,
  cache = true,
  nowImpl = () => Date.now(),
  warnImpl = (...args) => logWarn(...args),
}: {
  createClientImpl?: ({
    apiKey,
    baseURL,
    maxRetries,
  }: {
    apiKey: string;
    baseURL: string;
    maxRetries: number;
  }) => DeepInfraClientLike;
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
      maxRetries: 0,
    });

    if (cache) {
      localCachedClient = client;
    }

    return client;
  }

  const getPromptEmbeddings = createPromptEmbeddingsGetter(getOpenAiClient);

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
    } = options;
    const client = getOpenAiClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    void format;
    const messages = buildChatMessages(user, images);
    const systemPrompt = buildDeepInfraSystemPrompt({
      system,
      systemPromptOverride,
      userProfile,
    });
    const model = resolveChatModel(userProfile);
    const payload = buildDeepInfraPayload({ model, systemPrompt, messages });
    const payloadBytes = estimateJsonByteLength(payload);
    const requestStartedAt = nowImpl();
    releaseImageBuffers(images);
    onPayloadBuilt?.();
    let stream;
    try {
      stream = await client.chat.completions.create({
        ...payload,
        stream: true,
      });
    } catch (error) {
      logDeepInfraRequestFailure({
        error,
        model,
        requestStartedAt,
        imageCount: Array.isArray(images) ? images.length : 0,
        payloadBytes,
        nowImpl,
        warnImpl,
      });
      throw error;
    }

    const content = await collectStreamText(stream);
    const response = {
      choices: [
        {
          message: {
            content,
          },
        },
      ],
      output_text: content,
    };
    const json = parseDeepInfraJsonResponse(content);

    return {
      response,
      json,
    };
  }

  return { generateJsonWithLlm, getOpenAiClient, getPromptEmbeddings };
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

function buildChatMessages(
  user: string,
  images: ImageAssetLike[] = [],
): DeepInfraChatMessageContent[] {
  const content: Array<
    | { type: "image_url"; image_url: { url: string } }
    | { type: "text"; text: string }
  > = [];
  const userText = String(user || "").trim();

  for (const image of images) {
    const imageUrl = buildImageDataUrl(image);
    if (!imageUrl) {
      logWarn(
        "[deepinfra][image-skipped]",
        JSON.stringify({
          category: image?.category ?? null,
          filename: image?.filename ?? null,
          reason: "missing_buffer",
        }),
      );
      continue;
    }

    content.push({
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    });
  }

  if (userText) {
    content.push({
      type: "text",
      text: userText,
    });
  }

  return content.length > 0 ? content : [{ type: "text", text: "" }];
}

const deepInfraClient = createDeepInfraClient();
const { generateJsonWithLlm, getOpenAiClient, getPromptEmbeddings } =
  deepInfraClient;

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
  resolveChatModel,
};
