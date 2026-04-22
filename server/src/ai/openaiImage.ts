import OpenAI, { toFile } from "openai";
import type { ImageAssetLike } from "./types.js";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_OUTPUT_MIME_TYPE = "image/png";

type OpenAiImageFile = Awaited<ReturnType<typeof toFile>>;

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string | null;
    url?: string | null;
    revised_prompt?: string | null;
  }> | null;
  output_format?: "png" | "jpeg" | "webp" | string | null;
};

type OpenAiImageClientLike = {
  images: {
    generate: (payload: Record<string, unknown>) => Promise<OpenAiImageResponse>;
    edit: (payload: Record<string, unknown>) => Promise<OpenAiImageResponse>;
  };
};

let cachedClient: OpenAiImageClientLike | null = null;

function getOutputMimeType(response: OpenAiImageResponse | null | undefined) {
  const outputFormat = String(response?.output_format || "png").trim().toLowerCase();
  if (outputFormat === "jpeg" || outputFormat === "jpg") {
    return "image/jpeg";
  }
  if (outputFormat === "webp") {
    return "image/webp";
  }
  return DEFAULT_OUTPUT_MIME_TYPE;
}

function extractGeneratedImage(response: OpenAiImageResponse | null | undefined) {
  const images = Array.isArray(response?.data) ? response.data : [];
  for (const image of images) {
    if (typeof image?.b64_json === "string" && image.b64_json.length > 0) {
      return {
        base64: image.b64_json,
        mimeType: getOutputMimeType(response)
      };
    }
  }

  throw new Error("openai_image_missing_output");
}

function getImageFileName(image: ImageAssetLike, index: number) {
  const filename = typeof image?.filename === "string" && image.filename.trim().length > 0
    ? image.filename.trim()
    : `image-${index + 1}.jpg`;
  return filename;
}

async function buildOpenAiImageFiles(images: ImageAssetLike[] = []) {
  const files: OpenAiImageFile[] = [];

  for (const [index, image] of images.entries()) {
    if (!Buffer.isBuffer(image?.buffer) || image.buffer.length === 0) {
      console.warn(
        "[openai-image][image-skipped]",
        JSON.stringify({
          category: image?.category ?? null,
          filename: image?.filename ?? null,
          reason: "missing_buffer"
        })
      );
      continue;
    }

    const mimeType = typeof image?.mimeType === "string" && image.mimeType.trim().length > 0
      ? image.mimeType.trim()
      : "image/jpeg";
    files.push(await toFile(image.buffer, getImageFileName(image, index), { type: mimeType }));
  }

  return files;
}

function createOpenAiImageClient({
  createClientImpl = ({ apiKey }: { apiKey: string }): OpenAiImageClientLike => new OpenAI({
    apiKey,
    timeout: 3 * 1000 * 60,
    maxRetries: 0
  }) as unknown as OpenAiImageClientLike,
  getApiKeyImpl = () => process.env.OPENAI_API_KEY,
  cache = true
}: {
  createClientImpl?: ({ apiKey }: { apiKey: string }) => OpenAiImageClientLike;
  getApiKeyImpl?: () => string | undefined;
  cache?: boolean;
} = {}) {
  let localCachedClient: OpenAiImageClientLike | null = null;

  function getOpenAiImageClient() {
    if (cache && cachedClient) {
      return cachedClient;
    }
    if (cache && localCachedClient) {
      return localCachedClient;
    }

    const apiKey = getApiKeyImpl();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const client = createClientImpl({ apiKey });
    if (cache) {
      cachedClient = client;
      localCachedClient = client;
    }
    return client;
  }

  async function generateImageWithOpenAi(
    prompt: string,
    {
      images = [],
      model = DEFAULT_IMAGE_MODEL,
      onPayloadBuilt = null
    }: {
      images?: ImageAssetLike[];
      model?: string;
      onPayloadBuilt?: ((payload: Record<string, unknown>) => void) | null;
    } = {}
  ) {
    const client = getOpenAiImageClient();
    const imageFiles = await buildOpenAiImageFiles(images);
    const requestPayload = imageFiles.length > 0
      ? {
        model,
        prompt,
        image: imageFiles,
        n: 1
      }
      : {
        model,
        prompt,
        n: 1
      };

    onPayloadBuilt?.(requestPayload);

    const response = imageFiles.length > 0
      ? await client.images.edit(requestPayload)
      : await client.images.generate(requestPayload);

    return {
      response,
      image: extractGeneratedImage(response)
    };
  }

  return {
    generateImageWithOpenAi,
    getOpenAiImageClient
  };
}

const openAiImageClient = createOpenAiImageClient();

export {
  DEFAULT_IMAGE_MODEL,
  buildOpenAiImageFiles,
  createOpenAiImageClient,
  extractGeneratedImage
};

export const generateImageWithOpenAi = openAiImageClient.generateImageWithOpenAi;
export const getOpenAiImageClient = openAiImageClient.getOpenAiImageClient;
