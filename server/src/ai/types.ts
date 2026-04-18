type JsonSchemaPrimitiveType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

type JsonSchema = {
  type?: JsonSchemaPrimitiveType | JsonSchemaPrimitiveType[];
  description?: string;
  title?: string;
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
};

type JsonSchemaFormat = {
  type: "json_schema";
  name: string;
  description?: string;
  schema: JsonSchema;
  strict?: boolean;
};

type UserProfileLike = {
  llm?: string | null;
  style?: string | null;
  color?: string | null;
  audience?: string | null;
  formalityLevel?: string | null;
  season?: string[] | string | null;
  occasions?: string[] | null;
  locale?: string | null;
  pattern?: string | null;
  text?: string | null;
};

type ImageAssetLike = {
  buffer?: Buffer | Uint8Array | null;
  mimeType?: string | null;
  filename?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  originalImageUrl?: string | null;
};

type LlmGenerateOptions = {
  userProfile?: UserProfileLike | null;
  format?: JsonSchemaFormat | null;
  images?: ImageAssetLike[];
  onPayloadBuilt?: (() => void) | null;
};

type LlmGenerationResult<TJson = unknown, TResponse = unknown> = {
  response: TResponse;
  json: TJson;
};

type LlmUsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  output_tokens_details?: {
    reasoning_tokens?: number;
  } | null;
};

type ParsedGenerationError = Error & {
  rawSelectionText?: string | null;
};

type PromptImageItemLike = {
  id?: string | number | null;
  category?: string | null;
  image_url?: string | null;
};

type PromptImageTimings = {
  cacheLookupMs: number;
  networkFetchMs: number;
  sourceInspectMs: number;
  tileBuildMs: number;
  collageEncodeMs: number;
  debugSaveMs: number;
  categoryBuildMs: number;
  childRoundTripMs: number;
};

type PromptImageDownloadResult = {
  id: string;
  category: string;
  source: "cache" | "download" | null;
  imageUrl: string;
  originalImageUrl: string;
  cachePath?: string;
  status: "downloaded" | "skipped";
  reason: string | null;
  mimeType: string | null;
  originalMimeType?: string | null;
  buffer: Buffer | null;
  width: number | null;
  height: number | null;
};

type PromptImageAsset = {
  buffer: Buffer;
  mimeType: string | null;
  source?: "cache" | "download" | null;
  imageUrl?: string;
  originalImageUrl?: string;
  width?: number | null;
  height?: number | null;
  kind?: string | null;
  preparedForPdf?: boolean;
};

type PromptDebugImageItemManifest = {
  slotIndex?: number;
  id?: string;
  source?: "cache" | "download" | null;
  imageUrl?: string;
  originalImageUrl?: string;
  status?: "downloaded" | "skipped";
  reason?: string | null;
  tileFile?: string;
};

type PromptDebugImageCategory = {
  category?: string;
  mimeType?: string;
  filename?: string;
  totalItems?: number;
  cachedCount?: number;
  downloadedCount?: number;
  skippedCount?: number;
  items?: PromptDebugImageItemManifest[];
  buffer?: Buffer | Uint8Array | null;
  bufferBase64?: string;
  file?: string;
};

type PromptDebugImageStitched = {
  category?: string;
  mimeType?: string;
  filename?: string;
  totalItems?: number;
  categoryCount?: number;
  buffer?: Buffer | Uint8Array | null;
  bufferBase64?: string;
  file?: string;
};

type PromptDebugImageResult = {
  cachedCount?: number;
  downloadedCount?: number;
  skippedCount?: number;
  timings?: PromptImageTimings | Record<string, number>;
  stitched?: PromptDebugImageStitched | null;
  categories?: PromptDebugImageCategory[];
};

type SerializedIpcBuffer = {
  type: "Buffer";
  data: number[];
};

type PromptImagesChildMessage = {
  normalizedItems?: PromptImageItemLike[];
  downloadConcurrency?: number;
};

type PromptImagesChildSuccessPayload = PromptDebugImageResult & {
  ok: true;
};

type PromptImagesChildFailurePayload = {
  ok: false;
  message?: string;
  stack?: string;
};

type PromptImagesChildPayload = PromptImagesChildSuccessPayload | PromptImagesChildFailurePayload;

type SwimwearType = "swimsuit" | "swimwear_top" | "swimwear_bottom";

type SwimwearCandidate = {
  id?: string | number | null;
  url?: string | null;
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
  audience?: string | null;
  color_base?: string[] | null;
  pattern?: string | null;
  style?: string[] | null;
  is_neutral?: boolean | null;
  swimwear_type?: SwimwearType | null;
};

export type {
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LlmGenerateOptions,
  LlmGenerationResult,
  LlmUsageLike,
  ParsedGenerationError,
  PromptDebugImageCategory,
  PromptDebugImageItemManifest,
  PromptDebugImageResult,
  PromptDebugImageStitched,
  PromptImageAsset,
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimings,
  PromptImagesChildFailurePayload,
  PromptImagesChildMessage,
  PromptImagesChildPayload,
  PromptImagesChildSuccessPayload,
  SerializedIpcBuffer,
  SwimwearCandidate,
  SwimwearType,
  UserProfileLike
};
