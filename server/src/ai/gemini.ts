import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  buildDeveloperPrompt,
  buildJsonObjectFormat,
  releaseImageBuffers,
  splitSystemAndUserPrompt
} from "./openai.js";
import type {
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LlmGenerateOptions,
  ParsedGenerationError,
  UserProfileLike
} from "./types.js";

const DEFAULT_CHAT_MODEL = "gemini-2.5-pro";
const ALLOWED_CHAT_MODELS = ["gemini-2.5-pro"];
const DEFAULT_API_VERSION = "v1beta";

type GeminiUploadedFileLike = {
  uri?: string | null;
  name?: string | null;
  mimeType?: string | null;
};

type GeminiGenerateContentResponseLike = {
  text?: string;
  candidates?: Array<{ finishReason?: string; content?: { parts?: unknown[] } }>;
};

type GeminiClientLike = {
  models: {
    generateContent: (params: Record<string, unknown>) => Promise<GeminiGenerateContentResponseLike>;
  };
  files: {
    upload: (params: Record<string, unknown>) => Promise<GeminiUploadedFileLike>;
    delete: (params: { name?: string }) => Promise<unknown>;
  };
  apiKey?: string;
  apiVersion?: string;
};

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
  uploadedFiles: Array<{ uri?: string | null; mimeType?: string | null }> = []
) {
  const content: Array<{ fileData: { fileUri: string; mimeType: string } } | { text: string }> = [];
  const userText = String(user || "").trim();

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

  if (userText) {
    content.push({ text: userText });
  }

  return content.length > 0 ? content : [""];
}

function buildGeminiSystemInstruction(system = "", userProfile: UserProfileLike | null = null) {
  const systemText = String(system || "").trim();
  const developerText = buildDeveloperPrompt(userProfile);

  return [systemText, developerText]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

function buildZodSchemaFromJsonSchema(schema: JsonSchema | undefined | null): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") {
    return z.any();
  }

  const type = Array.isArray(schema.type) ? schema.type : [schema.type];
  const supportsNull = type.includes("null");
  const nonNullType = type.find((value) => value !== "null");

  let zodSchema;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const enumValues = schema.enum.filter((value): value is string => typeof value === "string");
    zodSchema = enumValues.length > 0
      ? z.enum(enumValues as [string, ...string[]])
      : z.string();
  } else {
    switch (nonNullType) {
      case "object": {
        const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
        const required = new Set(Array.isArray(schema.required) ? schema.required : []);
        const shape = Object.fromEntries(
          Object.entries(properties).map(([key, value]) => {
            const propertySchema = buildZodSchemaFromJsonSchema(value);
            return [key, required.has(key) ? propertySchema : propertySchema.optional()];
          })
        );
        zodSchema = z.object(shape);
        if (schema.additionalProperties === false) {
          zodSchema = zodSchema.strict();
        }
        break;
      }
      case "array": {
        const itemSchema = buildZodSchemaFromJsonSchema(schema.items);
        zodSchema = z.array(itemSchema);
        if (typeof schema.minItems === "number") {
          zodSchema = zodSchema.min(schema.minItems);
        }
        if (typeof schema.maxItems === "number") {
          zodSchema = zodSchema.max(schema.maxItems);
        }
        break;
      }
      case "integer":
        zodSchema = z.number().int();
        if (typeof schema.minimum === "number") {
          zodSchema = zodSchema.min(schema.minimum);
        }
        if (typeof schema.maximum === "number") {
          zodSchema = zodSchema.max(schema.maximum);
        }
        break;
      case "number":
        zodSchema = z.number();
        if (typeof schema.minimum === "number") {
          zodSchema = zodSchema.min(schema.minimum);
        }
        if (typeof schema.maximum === "number") {
          zodSchema = zodSchema.max(schema.maximum);
        }
        break;
      case "boolean":
        zodSchema = z.boolean();
        break;
      case "string":
      default:
        zodSchema = z.string();
        break;
    }
  }

  if (typeof schema.description === "string" && schema.description.trim().length > 0) {
    zodSchema = zodSchema.describe(schema.description.trim());
  } else if (typeof schema.title === "string" && schema.title.trim().length > 0) {
    zodSchema = zodSchema.describe(schema.title.trim());
  }

  return supportsNull ? zodSchema.nullable() : zodSchema;
}

function buildGeminiStructuredOutput(format: JsonSchemaFormat | null = null, userProfile: UserProfileLike | null = null) {
  const resolvedFormat = format || buildJsonObjectFormat(userProfile);
  const schema = resolvedFormat?.schema;
  const zodSchema = buildZodSchemaFromJsonSchema(schema);

  return {
    zodSchema,
    responseJsonSchema: zodToJsonSchema(zodSchema)
  };
}

function createGeminiClient({
  createClientImpl = ({ apiKey, apiVersion }: { apiKey: string; apiVersion: string }) => new GoogleGenAI({ apiKey, apiVersion }),
  getApiKeyImpl = () => process.env.GEMINI_API_KEY,
  cache = true,
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
    }) as GeminiClientLike;
    if (cache) {
      localCachedClient = client;
    }

    return client;
  }

  async function generateJsonWithLlm(prompt: string, options: LlmGenerateOptions = {}) {
    const {
      userProfile = null,
      format = null,
      images = [],
      onPayloadBuilt = null
    } = options;
    const client = getGeminiClient();
    const { system, user } = splitSystemAndUserPrompt(prompt);
    const systemInstruction = buildGeminiSystemInstruction(system, userProfile);
    const { zodSchema, responseJsonSchema } = buildGeminiStructuredOutput(format, userProfile);
    const uploadedFiles = await uploadImagesToGemini(client, images, uploadBufferToGeminiImpl);
    const contents = buildGeminiContents(user, uploadedFiles);
    releaseImageBuffers(images);
    onPayloadBuilt?.();

    const requestPayload = {
      model: resolveChatModel(userProfile),
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseJsonSchema
      }
    };
    try {
      const response = await client.models.generateContent(requestPayload);

      const finishReason = response?.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        console.warn(`[gemini][generation-aborted] Generation was interrupted by the server: ${finishReason}`);
      }

      let content = typeof response?.text === "string" ? response.text : "{}";
      let json;
      if (content) {
        content = content.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
      }
      try {
        json = zodSchema.parse(JSON.parse(content));
      } catch (error) {
        const parseError = new Error(
          `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${content}`
        ) as ParsedGenerationError;
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

async function uploadImagesToGemini(
  client: { files: { upload: (payload: unknown) => Promise<unknown> } },
  images: ImageAssetLike[],
  uploadBufferToGeminiImpl: typeof uploadBufferToGemini
) {
  const uploadedFiles: unknown[] = [];

  for (const image of images || []) {
    const uploadedFile = await uploadBufferToGeminiImpl(client, image);
    if (uploadedFile) {
      uploadedFiles.push(uploadedFile);
    }
  }

  return uploadedFiles;
}

function getMimeType(image: ImageAssetLike) {
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
  client: { files: { upload: (payload: unknown) => Promise<unknown> } },
  image: ImageAssetLike,
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

async function cleanupUploadedGeminiFiles(
  client: { files: { delete: ({ name }: { name: string }) => Promise<void> } },
  uploadedFiles: Array<{ name?: string | null }> = []
) {
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
        message: error instanceof Error ? error.message : "unknown_error"
      }));
    }
  }
}

const geminiClient = createGeminiClient();
const { generateJsonWithLlm, getGeminiClient } = geminiClient;

export {
  ALLOWED_CHAT_MODELS,
  buildGeminiContents,
  buildGeminiStructuredOutput,
  buildGeminiSystemInstruction,
  buildZodSchemaFromJsonSchema,
  cleanupUploadedGeminiFiles,
  createGeminiClient,
  generateJsonWithLlm,
  getGeminiClient,
  resolveChatModel,
  uploadBufferToGemini,
  uploadImagesToGemini
};
