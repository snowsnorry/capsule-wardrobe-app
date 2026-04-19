import { GoogleGenAI } from "@google/genai";

const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_API_VERSION = "v1beta";

type GeminiImageClientLike = {
  models: {
    generateContent: (payload: Record<string, unknown>) => Promise<unknown>;
  };
};

function buildGeminiImagePromptParts(prompt, images = []) {
  const promptParts = [];
  const text = String(prompt || "").trim();

  if (text) {
    promptParts.push({ text });
  }

  for (const image of images) {
    if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
      continue;
    }

    promptParts.push({
      inlineData: {
        mimeType: typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
          ? image.mimeType.trim()
          : "image/jpeg",
        data: image.buffer.toString("base64")
      }
    });
  }

  return promptParts;
}

function extractGeneratedImage(response) {
  const interactionOutputs = Array.isArray(response?.outputs) ? response.outputs : [];
  for (const output of interactionOutputs) {
    if (output?.type === "image" && typeof output?.data === "string" && output.data.length > 0) {
      return {
        base64: output.data,
        mimeType: output?.mime_type || "image/png"
      };
    }
  }

  const candidateParts = Array.isArray(response?.candidates)
    ? response.candidates.flatMap((candidate) => candidate?.content?.parts || [])
    : [];
  for (const part of candidateParts) {
    const inlineData = part?.inlineData || part?.inline_data || null;
    if (typeof inlineData?.data === "string" && inlineData.data.length > 0) {
      return {
        base64: inlineData.data,
        mimeType: inlineData?.mimeType || inlineData?.mime_type || "image/png"
      };
    }
  }

  const generatedImages = Array.isArray(response?.generatedImages) ? response.generatedImages : [];
  for (const image of generatedImages) {
    if (typeof image?.image?.imageBytes === "string" && image.image.imageBytes.length > 0) {
      return {
        base64: image.image.imageBytes,
        mimeType: image.image?.mimeType || "image/png"
      };
    }
  }

  throw new Error("gemini_image_missing_output");
}

function createGeminiImageClient({
  createClientImpl = ({ apiKey, apiVersion }) => new GoogleGenAI({ apiKey, apiVersion }),
  getApiKeyImpl = () => process.env.GEMINI_API_KEY
} = {}) {
  let cachedClient = null;

  function getGeminiImageClient() {
    if (cachedClient) {
      return cachedClient;
    }

    const apiKey = getApiKeyImpl();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    cachedClient = createClientImpl({
      apiKey,
      apiVersion: DEFAULT_API_VERSION
    }) as GeminiImageClientLike;
    return cachedClient;
  }

  async function generateImageWithGemini(
    prompt,
    {
      images = [],
      model = DEFAULT_IMAGE_MODEL,
      onPayloadBuilt = null
    } = {}
  ) {
    const client = getGeminiImageClient();
    const promptParts = buildGeminiImagePromptParts(prompt, images);
    const requestPayload = {
      model,
      contents: promptParts,
      config: {
        responseModalities: ["IMAGE"]
      }
    }

    onPayloadBuilt?.(requestPayload);

    const response = await client.models.generateContent(requestPayload);

    return {
      response,
      image: extractGeneratedImage(response)
    };
  }

  return {
    generateImageWithGemini,
    getGeminiImageClient
  };
}

const geminiImageClient = createGeminiImageClient();

export {
  DEFAULT_IMAGE_MODEL,
  buildGeminiImagePromptParts,
  createGeminiImageClient,
  extractGeneratedImage
};

export const generateImageWithGemini = geminiImageClient.generateImageWithGemini;
export const getGeminiImageClient = geminiImageClient.getGeminiImageClient;
