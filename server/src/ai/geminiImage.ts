import { GoogleGenAI } from "@google/genai";

const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image";
const DEFAULT_API_VERSION = "v1beta";

type GeminiImagePromptPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiImageGenerateContentPayload = {
  model: string;
  contents: GeminiImagePromptPart[];
  config: {
    responseModalities: ["IMAGE"];
  };
};

type GeminiImageGenerateContentResponse = {
  outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
        inline_data?: { data?: string; mime_type?: string };
      }>;
    };
  }>;
  generatedImages?: Array<{
    image?: {
      imageBytes?: string;
      mimeType?: string;
    };
  }>;
};

type GeminiImageClientLike = {
  models: {
    generateContent: (
      payload: GeminiImageGenerateContentPayload,
    ) => Promise<GeminiImageGenerateContentResponse>;
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
        mimeType:
          typeof image?.mimeType === "string" &&
          image.mimeType.trim().length > 0
            ? image.mimeType.trim()
            : "image/jpeg",
        data: image.buffer.toString("base64"),
      },
    });
  }

  return promptParts;
}

function extractGeneratedImage(response) {
  const image =
    getInteractionOutputImage(response) ||
    getCandidatePartImage(response) ||
    getGeneratedImage(response);

  if (!image) {
    throw new Error("gemini_image_missing_output");
  }
  return image;
}

function getInteractionOutputImage(response) {
  const output = (
    Array.isArray(response?.outputs) ? response.outputs : []
  ).find(
    (item) =>
      item?.type === "image" &&
      typeof item?.data === "string" &&
      item.data.length > 0,
  );
  return output
    ? { base64: output.data, mimeType: output?.mime_type || "image/png" }
    : null;
}

function getCandidatePartImage(response) {
  const part = (Array.isArray(response?.candidates) ? response.candidates : [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .find((item) => {
      const inlineData = item?.inlineData || item?.inline_data || null;
      return typeof inlineData?.data === "string" && inlineData.data.length > 0;
    });
  const inlineData = part?.inlineData || part?.inline_data || null;
  return inlineData
    ? {
        base64: inlineData.data,
        mimeType: inlineData?.mimeType || inlineData?.mime_type || "image/png",
      }
    : null;
}

function getGeneratedImage(response) {
  const image = (
    Array.isArray(response?.generatedImages) ? response.generatedImages : []
  ).find(
    (item) =>
      typeof item?.image?.imageBytes === "string" &&
      item.image.imageBytes.length > 0,
  );
  return image
    ? {
        base64: image.image.imageBytes,
        mimeType: image.image?.mimeType || "image/png",
      }
    : null;
}

function createGeminiImageClient({
  createClientImpl = ({
    apiKey,
    apiVersion,
  }: {
    apiKey: string;
    apiVersion: string;
  }): GeminiImageClientLike => {
    const sdkClient = new GoogleGenAI({ apiKey, apiVersion });
    return {
      models: {
        generateContent: (payload: GeminiImageGenerateContentPayload) =>
          sdkClient.models.generateContent(
            payload as Parameters<typeof sdkClient.models.generateContent>[0],
          ) as Promise<GeminiImageGenerateContentResponse>,
      },
    };
  },
  getApiKeyImpl = () => process.env.GEMINI_API_KEY,
}: {
  createClientImpl?: ({
    apiKey,
    apiVersion,
  }: {
    apiKey: string;
    apiVersion: string;
  }) => GeminiImageClientLike;
  getApiKeyImpl?: () => string | undefined;
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
      apiVersion: DEFAULT_API_VERSION,
    });
    return cachedClient;
  }

  async function generateImageWithGemini(
    prompt,
    { images = [], model = DEFAULT_IMAGE_MODEL, onPayloadBuilt = null } = {},
  ) {
    const client = getGeminiImageClient();
    const promptParts = buildGeminiImagePromptParts(prompt, images);
    const requestPayload = {
      model,
      contents: promptParts,
      config: {
        responseModalities: ["IMAGE"],
      },
    };

    onPayloadBuilt?.(requestPayload);

    const response = await client.models.generateContent(requestPayload);

    return {
      response,
      image: extractGeneratedImage(response),
    };
  }

  return {
    generateImageWithGemini,
    getGeminiImageClient,
  };
}

const geminiImageClient = createGeminiImageClient();

export {
  buildGeminiImagePromptParts,
  createGeminiImageClient,
  extractGeneratedImage,
};

export const generateImageWithGemini =
  geminiImageClient.generateImageWithGemini;
