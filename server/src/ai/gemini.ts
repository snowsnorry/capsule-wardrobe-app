import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, splitSystemAndUserPrompt } from "./llmPrompts.js";
import { buildGeminiStructuredOutput } from "./geminiSchema.js";
import { releaseImageBuffers } from "./openai.js";
import { logWarn } from "../logger.js";
import {
  cleanupUploadedGeminiFiles,
  uploadBufferToGemini,
  uploadImagesToGemini,
} from "./geminiUploads.js";
import type {
  LlmGenerateOptions,
  ParsedGenerationError,
  UserProfileLike,
} from "./types.js";
import type {
  GeminiClientLike,
  GeminiGenerateContentResponseLike,
  GeminiUploadedFileLike,
} from "./geminiTypes.js";
import { throwIfAborted } from "./abortSignal.js";

const DEFAULT_CHAT_MODEL = "gemini-2.5-pro";
const ALLOWED_CHAT_MODELS = ["gemini-2.5-pro"];
const DEFAULT_API_VERSION = "v1beta";
const GEMINI_HTTP_TIMEOUT_MS = 2 * 60 * 1000;

function resolveChatModel(userProfile: UserProfileLike | null = null) {
  const llm = String(userProfile?.llm || "").trim();
  if (llm.startsWith("gemini:")) {
    const model = llm.slice("gemini:".length).trim();
    if (ALLOWED_CHAT_MODELS.includes(model)) {
      return model;
    }
  }

  return DEFAULT_CHAT_MODEL;
}

function buildGeminiContents(
  user: string,
  uploadedFiles: Array<{ uri?: string | null; mimeType?: string | null }> = [],
) {
  const content: Array<
    { fileData: { fileUri: string; mimeType: string } } | { text: string }
  > = [];
  const userText = String(user || "").trim();

  for (const file of uploadedFiles) {
    if (file && file.uri) {
      content.push({
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType || "image/jpeg",
        },
      });
    }
  }

  if (userText) {
    content.push({ text: userText });
  }

  return content.length > 0 ? content : [""];
}

function buildGeminiSystemInstruction(
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

type CreateGeminiClientImpl = ({
  apiKey,
  apiVersion,
  httpOptions,
}: {
  apiKey: string;
  apiVersion: string;
  httpOptions: { timeout: number };
}) => GeminiClientLike;

const defaultCreateGeminiClient: CreateGeminiClientImpl = ({
  apiKey,
  apiVersion,
  httpOptions,
}) => {
  const sdkClient = new GoogleGenAI({ apiKey, apiVersion, httpOptions });
  return {
    apiKey,
    apiVersion,
    models: {
      generateContent: (params) =>
        sdkClient.models.generateContent(
          params as Parameters<typeof sdkClient.models.generateContent>[0],
        ) as Promise<GeminiGenerateContentResponseLike>,
    },
    files: {
      upload: (params) =>
        sdkClient.files.upload(
          params as Parameters<typeof sdkClient.files.upload>[0],
        ) as Promise<GeminiUploadedFileLike>,
      delete: (params) =>
        sdkClient.files.delete(
          params as Parameters<typeof sdkClient.files.delete>[0],
        ),
    },
  };
};

function logGeminiFinishReason(response) {
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    logWarn(
      `[gemini][generation-aborted] Generation was interrupted by the server: ${finishReason}`,
    );
  }
}

function getGeminiResponseContent(response) {
  const content = typeof response?.text === "string" ? response.text : "{}";
  return content
    ? content.replace(/^[^{]*/, "").replace(/[^}]*$/, "")
    : content;
}

function getGeminiRawText(response) {
  return typeof response?.text === "string" && response.text.trim().length > 0
    ? response.text.trim()
    : null;
}

function parseGeminiJsonResponse(response, zodSchema) {
  const content = getGeminiResponseContent(response);
  try {
    return zodSchema.parse(JSON.parse(content));
  } catch (error) {
    const parseError = new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${content}`,
    ) as ParsedGenerationError;
    parseError.rawSelectionText = getGeminiRawText(response);
    throw parseError;
  }
}

function buildGeminiRequestPayload({
  userProfile,
  contents,
  systemInstruction,
  responseJsonSchema,
}) {
  return {
    model: resolveChatModel(userProfile),
    contents,
    config: {
      systemInstruction: systemInstruction || undefined,
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseJsonSchema,
    },
  };
}

function createGeminiClient({
  createClientImpl = defaultCreateGeminiClient,
  getApiKeyImpl = () => process.env.GEMINI_API_KEY,
  cache = true,
  uploadBufferToGeminiImpl = uploadBufferToGemini,
  cleanupUploadedFilesImpl = cleanupUploadedGeminiFiles,
}: {
  createClientImpl?: CreateGeminiClientImpl;
  getApiKeyImpl?: () => string | undefined;
  cache?: boolean;
  uploadBufferToGeminiImpl?: typeof uploadBufferToGemini;
  cleanupUploadedFilesImpl?: typeof cleanupUploadedGeminiFiles;
} = {}) {
  let localCachedClient = null;

  function getGeminiClient() {
    if (cache && localCachedClient) {
      return localCachedClient;
    }

    const apiKey = getApiKeyImpl();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const client = createClientImpl({
      apiKey,
      apiVersion: DEFAULT_API_VERSION,
      httpOptions: {
        timeout: GEMINI_HTTP_TIMEOUT_MS,
      },
    });
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
    const client = getGeminiClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    const systemInstruction = buildGeminiSystemInstruction(
      system,
      userProfile,
      systemPromptOverride,
    );
    const { zodSchema, responseJsonSchema } = buildGeminiStructuredOutput(
      format,
      userProfile,
    );
    const uploadedFiles = await uploadImagesToGemini(
      client,
      images,
      uploadBufferToGeminiImpl,
    );
    const contents = buildGeminiContents(user, uploadedFiles);
    releaseImageBuffers(images);
    onPayloadBuilt?.();
    throwIfAborted(signal);

    const requestPayload = buildGeminiRequestPayload({
      userProfile,
      contents,
      systemInstruction,
      responseJsonSchema,
    });
    try {
      const response = await client.models.generateContent(requestPayload);
      throwIfAborted(signal);
      logGeminiFinishReason(response);
      const json = parseGeminiJsonResponse(response, zodSchema);
      return buildGeminiGenerationResult(response, json);
    } finally {
      await cleanupUploadedFilesImpl(client, uploadedFiles);
    }
  }

  return {
    generateJsonWithLlm,
    getGeminiClient,
  };
}

function buildGeminiGenerationResult(response, json) {
  return {
    response: {
      ...response,
      output_text: typeof response?.text === "string" ? response.text : null,
    },
    json,
  };
}

const geminiClient = createGeminiClient();
const { generateJsonWithLlm } = geminiClient;

export {
  ALLOWED_CHAT_MODELS,
  buildGeminiContents,
  buildGeminiSystemInstruction,
  createGeminiClient,
  generateJsonWithLlm,
  resolveChatModel,
};
