type GeminiUploadedFileLike = {
  uri?: string | null;
  name?: string | null;
  mimeType?: string | null;
};

type GeminiContentPart = { fileData: { fileUri: string; mimeType: string } } | { text: string };

type GeminiJsonSchemaLike = {
  type?: string;
  additionalProperties?: boolean;
  properties?: Record<string, GeminiJsonSchemaLike>;
  required?: string[];
  items?: GeminiJsonSchemaLike;
};

type GeminiGenerateContentPayload = {
  model: string;
  contents: GeminiContentPart[] | [""];
  config: {
    systemInstruction?: string;
    temperature: number;
    topP: number;
    maxOutputTokens: number;
    responseMimeType: "application/json";
    responseJsonSchema: GeminiJsonSchemaLike;
  };
};

type GeminiGenerateContentResponseLike = {
  text?: string | null;
  candidates?: Array<{ finishReason?: string; content?: { parts?: unknown[] } }>;
};

type GeminiClientLike = {
  models: {
    generateContent: (params: GeminiGenerateContentPayload) => Promise<GeminiGenerateContentResponseLike>;
  };
  files: {
    upload: (params: {
      file: string;
      config: { mimeType: string; displayName?: string };
    }) => Promise<GeminiUploadedFileLike>;
    delete: (params: { name: string }) => Promise<unknown>;
  };
  apiKey?: string;
  apiVersion?: string;
};

export type {
  GeminiClientLike,
  GeminiContentPart,
  GeminiGenerateContentPayload,
  GeminiGenerateContentResponseLike,
  GeminiJsonSchemaLike,
  GeminiUploadedFileLike
};
