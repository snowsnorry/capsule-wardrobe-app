import OpenAI from "openai";
import { buildSystemPrompt, splitSystemAndUserPrompt } from "./llmPrompts.js";
import { releaseImageBuffers } from "./openai.js";
import {
  buildChatMessages,
  type DeepInfraChatMessageContent,
} from "./deepinfraChatMessages.js";
import {
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  parseDeepInfraJsonResponse,
} from "./deepinfraResponse.js";
import type { LlmGenerateOptions, UserProfileLike } from "./types.js";
import { logWarn } from "../logger.js";
import { throwIfAborted } from "./abortSignal.js";

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
type DeepInfraChatCompletionRequest = Omit<
  DeepInfraChatCompletionPayload,
  "stream"
>;

type DeepInfraChatCompletionsClient = {
  create: (
    payload: DeepInfraChatCompletionPayload,
    options?: { signal?: AbortSignal },
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
  const chatMessages: DeepInfraChatCompletionRequest["messages"] = [];
  if (systemPrompt) {
    chatMessages.push({ role: "system", content: systemPrompt });
  }
  chatMessages.push({ role: "user", content: messages });

  return {
    model,
    messages: chatMessages,
    temperature: 0.2,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 10000,
    response_format: { type: "json_object" },
  } satisfies DeepInfraChatCompletionRequest;
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
        create: (payload, options) =>
          sdkClient.chat.completions
            .create(
              payload as Parameters<
                typeof sdkClient.chat.completions.create
              >[0],
              options,
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
      signal = null,
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
    throwIfAborted(signal);
    const stream = await createDeepInfraResponseStream(client, payload, {
      imageCount: Array.isArray(images) ? images.length : 0,
      model,
      nowImpl,
      payloadBytes,
      requestStartedAt,
      signal,
      warnImpl,
    });

    const content = await collectStreamText(stream);
    throwIfAborted(signal);
    const response = buildDeepInfraTextResponse(content);
    const json = parseDeepInfraJsonResponse(content);

    return {
      response,
      json,
    };
  }

  return { generateJsonWithLlm, getOpenAiClient, getPromptEmbeddings };
}

function buildDeepInfraTextResponse(content: string) {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
    output_text: content,
  };
}

async function createDeepInfraResponseStream(
  client: DeepInfraClientLike,
  payload: ReturnType<typeof buildDeepInfraPayload>,
  logContext: Omit<DeepInfraRequestLogContext, "error"> & {
    signal?: AbortSignal | null;
  },
) {
  const { signal, ...requestLogContext } = logContext;
  try {
    return await client.chat.completions.create(
      {
        ...payload,
        stream: true,
      },
      signal ? { signal } : undefined,
    );
  } catch (error) {
    logDeepInfraRequestFailure({ error, ...requestLogContext });
    throw error;
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

const deepInfraClient = createDeepInfraClient();
const { generateJsonWithLlm } = deepInfraClient;

export {
  createDeepInfraClient,
  ALLOWED_CHAT_MODELS,
  buildChatMessages,
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  generateJsonWithLlm,
  resolveChatModel,
};
