import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildJsonObjectFormat, releaseImageBuffers, splitSystemAndUserPrompt } from "./openai.js";

const DEFAULT_CHAT_MODEL = "gemini-2.5-pro";
const ALLOWED_CHAT_MODELS = ["gemini-2.5-pro"];
const DEFAULT_API_VERSION = "v1beta";
const MAX_RETRY_ATTEMPTS = 3;
let cachedClient = null;

function resolveChatModel(userProfile = null) {
  const llm = String(userProfile?.llm || "").trim();
  if (llm.startsWith("gemini:")) {
    const model = llm.slice("gemini:".length).trim();
    if (ALLOWED_CHAT_MODELS.includes(model)) {
      return model;
    }
  }

  return DEFAULT_CHAT_MODEL;
}

function buildGeminiContents(user, uploadedFiles = []) {
  const content = [];
  const userText = String(user || "").trim();

  if (userText) {
    content.push({ text: userText });
  }

  for (const file of uploadedFiles) {
    if (file && file.uri) {
      content.push({
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType || "image/jpeg"
        }
      });
    }
  }

  return content.length > 0 ? content : [""];
}

function createGeminiClient({
  createClientImpl = ({ apiKey, apiVersion }) => new GoogleGenAI({ apiKey, apiVersion }),
  getApiKeyImpl = () => process.env.GEMINI_API_KEY,
  cache = true,
  waitImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  uploadBufferToGeminiImpl = uploadBufferToGemini,
  cleanupUploadedFilesImpl = cleanupUploadedGeminiFiles
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
      apiVersion: DEFAULT_API_VERSION
    });
    if (cache) {
      localCachedClient = client;
      cachedClient = client;
    }

    return client;
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
    const client = getGeminiClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    const responseSchema = (format || buildJsonObjectFormat(userProfile))?.schema || null;
    const uploadedFiles = await uploadImagesToGemini(client, images, uploadBufferToGeminiImpl);
    const contents = buildGeminiContents(user, uploadedFiles);
    releaseImageBuffers(images);
    onPayloadBuilt?.();

    const requestPayload = {
      model: resolveChatModel(userProfile),
      contents,
      config: {
        systemInstruction: system || undefined,
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        // responseSchema: responseSchema
      }
    };
    try {
      const response = await generateContentWithRetry(client, requestPayload, waitImpl);

      const finishReason = response?.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        console.warn(`[gemini][generation-aborted] Генерация прервана сервером! Причина: ${finishReason}`);
      }

      let content = typeof response?.text === "string" ? response.text : "{}";
      let json;
      if (content) {
        content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
      }
      try {
        json = JSON.parse(content);
      } catch (error) {
        const parseError = new Error(`Failed to parse JSON response: ${error.message}\nResponse content: ${content}`);
        parseError.rawSelectionText = typeof response?.text === "string" && response.text.trim().length > 0
          ? response.text.trim()
          : null;
        throw parseError;
      }

      return {
        response: {
          ...response,
          output_text: typeof response?.text === "string" ? response.text : null
        },
        json
      };
    } finally {
      await cleanupUploadedFilesImpl(client, uploadedFiles);
    }
  }

  return {
    generateJsonWithLlm,
    getGeminiClient
  };
}

async function uploadImagesToGemini(client, images, uploadBufferToGeminiImpl) {
  const uploadedFiles = [];

  for (const image of images || []) {
    const uploadedFile = await uploadBufferToGeminiImpl(client, image);
    if (uploadedFile) {
      uploadedFiles.push(uploadedFile);
    }
  }

  return uploadedFiles;
}

function getMimeType(image) {
  return typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
    ? image.mimeType.trim()
    : "image/jpeg";
}

function getTempFileExtension(mimeType) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
    case "image/jpg":
    default:
      return ".jpg";
  }
}

async function uploadBufferToGemini(
  client,
  image,
  {
    writeFileSyncImpl = writeFileSync,
    unlinkSyncImpl = unlinkSync,
    tmpdirImpl = tmpdir,
    joinImpl = join,
    randomUUIDImpl = randomUUID
  } = {}
) {
  const buffer = image?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    console.warn(
      "[gemini][image-skipped]",
      JSON.stringify({
        category: image?.category ?? null,
        filename: image?.filename ?? null,
        reason: "missing_buffer"
      })
    );
    return null;
  }

  const mimeType = getMimeType(image);
  const tempFilePath = joinImpl(tmpdirImpl(), `${randomUUIDImpl()}${getTempFileExtension(mimeType)}`);

  try {
    writeFileSyncImpl(tempFilePath, buffer);
    return await client.files.upload({
      file: tempFilePath,
      config: {
        mimeType,
        displayName: typeof image?.filename === "string" && image.filename.trim().length > 0
          ? image.filename.trim()
          : undefined
      }
    });
  } finally {
    try {
      unlinkSyncImpl(tempFilePath);
    } catch {
      // Ignore cleanup failures for local temp files.
    }
  }
}

async function cleanupUploadedGeminiFiles(client, uploadedFiles = []) {
  for (const uploadedFile of uploadedFiles) {
    const name = typeof uploadedFile?.name === "string" ? uploadedFile.name.trim() : "";
    if (!name) {
      continue;
    }

    try {
      await client.files.delete({ name });
    } catch (error) {
      console.warn("[gemini][file-delete-failed]", JSON.stringify({
        name,
        message: error?.message || "unknown_error"
      }));
    }
  }
}

async function generateContentWithRetry(client, payload, waitImpl) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await client.models.generateContent(payload);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiTransportError(error) || attempt === MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      const delayMs = attempt * 500;
      console.warn("[gemini][request-retry]", JSON.stringify({
        attempt,
        delayMs,
        reason: error?.cause?.code || error?.message || "unknown_error"
      }));
      await waitImpl(delayMs);
    }
  }

  throw lastError;
}

function isRetryableGeminiTransportError(error) {
  const message = String(error?.message || "").toLowerCase();
  const causeCode = String(error?.cause?.code || "").trim();

  return message.includes("fetch failed")
    || causeCode === "UND_ERR_SOCKET"
    || causeCode === "ECONNRESET"
    || causeCode === "ETIMEDOUT";
}

const geminiClient = createGeminiClient();
const { generateJsonWithLlm, getGeminiClient } = geminiClient;

export {
  ALLOWED_CHAT_MODELS,
  buildGeminiContents,
  cleanupUploadedGeminiFiles,
  createGeminiClient,
  generateJsonWithLlm,
  generateContentWithRetry,
  getGeminiClient,
  isRetryableGeminiTransportError,
  resolveChatModel,
  uploadBufferToGemini,
  uploadImagesToGemini
};
