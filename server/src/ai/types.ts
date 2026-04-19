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
  rejected?: string[] | null;
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

type PromptImageTimingKey = keyof PromptImageTimings;

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
  timings?: PromptImageTimings | Partial<PromptImageTimings>;
  stitched?: PromptDebugImageStitched | null;
  categories?: PromptDebugImageCategory[];
};

type PromptDebugImageCategoryManifest = {
  category: string;
  file: string;
  totalItems: number;
  cachedCount: number;
  downloadedCount: number;
  skippedCount: number;
  items: PromptDebugImageItemManifest[];
};

type PromptDebugImageStitchedManifest = {
  category: string;
  file: string;
  totalItems: number;
  categoryCount: number;
};

type PromptDebugImageManifest = {
  generatedAt: string;
  outputDir: string;
  cachedCount: number;
  downloadedCount: number;
  skippedCount: number;
  files: string[];
  stitched: PromptDebugImageStitchedManifest | null;
  categories: PromptDebugImageCategoryManifest[];
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

type ErrorWithCode = Error & {
  code?: string;
};

type CountByKey = Record<string, number>;

type WardrobeUiItemLike = {
  id?: string | number | null;
  url?: string | null;
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
  audience?: string | null;
  color_base?: string[] | null;
  colorBase?: string[] | null;
  pattern?: string | null;
  finish?: string | null;
  style?: string[] | null;
  formality_level?: string[] | null;
  formalityLevel?: string[] | null;
  composition?: string | null;
  fit?: string | null;
  silhouette?: string | null;
  is_neutral?: boolean | null;
  isNeutral?: boolean | null;
};

type OutfitSetLike = {
  itemIds: string[];
  image: string | null;
  imageObsolete: boolean;
};

type GeneratedOutfitSetLike = {
  itemIds: string[];
  image?: string | null;
  imageObsolete?: boolean | null;
};

type StoredWardrobePayloadLike = {
  items: WardrobeUiItemLike[];
  outfitSets: OutfitSetLike[];
  reasoning: string | null;
  rawSelectionText: string | null;
  swimwearReasoning: string | null;
  swimwearRawSelectionText: string | null;
};

type CapsuleDataLike = {
  wardrobe?: StoredWardrobePayloadLike | null;
  rejectedUrls?: string[] | null;
};

type CapsuleSnapshotLike = {
  filters?: Record<string, unknown> | null;
  data?: CapsuleDataLike | null;
};

type CapsuleRecordLike = {
  id?: string | null;
  name?: string | null;
  draft?: CapsuleSnapshotLike | null;
  saved?: CapsuleSnapshotLike | null;
  status?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type LogContextLike = {
  capsuleRequestId?: string | null;
  startedAt?: number | null;
  source?: string | null;
};

type LlmUsageSummary = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

type WardrobeGenerationResult = {
  items: WardrobeUiItemLike[];
  selectedItems: WardrobeUiItemLike[];
  outfitSets: GeneratedOutfitSetLike[];
  promptEmbeddings: number[];
  rawSelectionText: string | null;
  reasoning: string | null;
};

type WardrobeJobState = {
  capsuleRequestId: string;
  status: "pending" | "completed" | "failed";
  startedAt: number;
  updatedAt: number;
  promise: Promise<void> | null;
  phase: "capsule" | "extras" | "completed" | "failed";
  result: StoredWardrobePayloadLike | null;
  error?: Error | unknown;
};

type PartialRegenerationJobState = {
  capsuleRequestId: string;
  status: "pending" | "completed" | "failed";
  phase: "regenerate" | "completed" | "failed";
  startedAt: number;
  updatedAt: number;
  pendingItemUrls: string[];
  result: StoredWardrobePayloadLike | null;
  promise: Promise<void> | null;
  error?: Error | unknown;
};

type ProfileWithItemsLike = {
  locale?: string | null;
  items?: StoredWardrobePayloadLike | { items?: WardrobeUiItemLike[] | null } | WardrobeUiItemLike[] | null;
};

type WardrobePdfJobState = {
  status: "pending" | "completed" | "failed";
  updatedAt: number;
  startedAt: number;
  generationKey: string;
  error: Error | unknown | null;
  promise: Promise<void> | null;
};

type WardrobePdfBuildChildOptions = {
  totalStartedAt?: number | null;
};

export type {
  CapsuleRecordLike,
  CapsuleSnapshotLike,
  CountByKey,
  ErrorWithCode,
  GeneratedOutfitSetLike,
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LogContextLike,
  LlmGenerateOptions,
  LlmGenerationResult,
  LlmUsageLike,
  LlmUsageSummary,
  OutfitSetLike,
  ParsedGenerationError,
  PartialRegenerationJobState,
  PromptDebugImageCategory,
  PromptDebugImageCategoryManifest,
  PromptDebugImageItemManifest,
  PromptDebugImageManifest,
  PromptDebugImageResult,
  PromptDebugImageStitched,
  PromptDebugImageStitchedManifest,
  PromptImageAsset,
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimingKey,
  PromptImageTimings,
  PromptImagesChildFailurePayload,
  PromptImagesChildMessage,
  PromptImagesChildPayload,
  PromptImagesChildSuccessPayload,
  SerializedIpcBuffer,
  StoredWardrobePayloadLike,
  SwimwearCandidate,
  SwimwearType,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeJobState,
  WardrobePdfBuildChildOptions,
  WardrobePdfJobState,
  WardrobeUiItemLike,
  ProfileWithItemsLike
};
