import OpenAI from "openai";
import { buildImageDataUrl, releaseImageBuffers } from "./openai.js";

const OPENAI_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEFAULT_CHAT_MODEL = "google/gemma-4-31B-it";
const DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-300m";
const ALLOWED_CHAT_MODELS = [
  "google/gemma-4-31B-it",
  "Qwen/Qwen3-VL-235B-A22B-Instruct"
];
let cachedClient = null;

function createDeepInfraClient({
  createClientImpl = ({ apiKey, baseURL, maxRetries }) => new OpenAI({ apiKey, baseURL, maxRetries }),
  getApiKeyImpl = () => process.env.DEEPINFRA_API_KEY,
  cache = true,
  nowImpl = () => Date.now(),
  warnImpl = (...args) => console.warn(...args)
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

  async function getPromptEmbeddings(prompt) {
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
    void format;
    const messages = buildChatMessages(user, images);
    const model = resolveChatModel(userProfile);
    const payload = {
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
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
      warnImpl(
        "[deepinfra][request-failed]",
        JSON.stringify({
          model,
          durationMs: Math.max(0, nowImpl() - requestStartedAt),
          imageCount: Array.isArray(images) ? images.length : 0,
          payloadBytes,
          status: error?.status,
          requestId: error?.request_id,
          code: error?.code,
          type: error?.type,
          causeName: error?.cause?.name ?? null,
          causeMessage: error?.cause?.message ?? null,
          causeCode: error?.cause?.code ?? null,
          causeErrno: error?.cause?.errno ?? null
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
      const parseError = new Error(`Failed to parse JSON response: ${error.message}\nResponse content: ${normalizedContent}`);
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

function resolveChatModel(userProfile = null) {
  const llm = String(userProfile?.llm || "").trim();
  if (llm.startsWith("deepinfra:")) {
    const model = llm.slice("deepinfra:".length).trim();
    if (ALLOWED_CHAT_MODELS.includes(model)) {
      return model;
    }
  }

  return DEFAULT_CHAT_MODEL;
}

function buildChatMessages(user, images = []) {
  const content = [];
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

function extractResponseText(response = null) {
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

async function collectStreamText(stream) {
  let content = "";

  for await (const chunk of stream) {
    content += extractChunkText(chunk);
  }

  return content;
}

function extractChunkText(chunk = null) {
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
  resolveChatModel,
  splitSystemAndUserPrompt
};
