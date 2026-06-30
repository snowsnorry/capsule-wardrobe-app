type JsonSchemaPrimitiveType =
  "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";

type JsonSchema = {
  type?: JsonSchemaPrimitiveType | JsonSchemaPrimitiveType[];
  description?: string;
  title?: string;
  enum?: Array<string | null>;
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
  email?: string | null;
  sourceMode?: "catalog_only" | "wardrobe_preferred" | "wardrobe_only" | null;
  llm?: string | null;
  imageLlm?: string | null;
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
  anchorWardrobeNumericIds?: number[] | null;
  anchorCatalogUrls?: string[] | null;
  anchorItemRefs?: Array<{
    source: "uploaded" | "from_catalog";
    url: string;
  }> | null;
  anchorItems?: WardrobeUiItemLike[] | null;
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
  systemPrompt?: string | null;
  onPayloadBuilt?: (() => void) | null;
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

type SwimwearType = "swimsuit" | "swimwear_top" | "swimwear_bottom";

type SwimwearCandidate = {
  id?: string | number | null;
  item_source?: "catalog" | "wardrobe" | string | null;
  source?: string | null;
  raw_image_url?: string | null;
  processing_status?: string | null;
  wardrobe_id?: string | number | null;
  product_id?: string | number | null;
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
  itemSource?: "catalog" | "wardrobe" | string | null;
  swimwearType?: SwimwearType | string | null;
  url?: string | null;
  name?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  rawImageUrl?: string | null;
  audience?: string | null;
  colorBase?: string[] | null;
  pattern?: string | null;
  finish?: string | null;
  style?: string[] | null;
  formalityLevel?: string[] | null;
  composition?: string | null;
  fit?: string | null;
  silhouette?: string | null;
  isNeutral?: boolean | null;
  closureType?: string[] | null;
  source?: string | null;
  processingStatus?: string | null;
  wardrobeId?: string | number | null;
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
  rawSelectionText: string | null;
  swimwearReasoning: string | null;
  swimwearRawSelectionText: string | null;
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
  shortCapsuleName: string | null;
  rawSelectionText: string | null;
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
  items?:
    | StoredWardrobePayloadLike
    | { items?: WardrobeUiItemLike[] | null }
    | WardrobeUiItemLike[]
    | null;
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
  capsule?: {
    title?: string | null;
    report?: Record<string, unknown> | null;
    reportStale?: boolean;
  } | null;
  outfit?: {
    title?: string | null;
    imageUrl?: string | null;
    imageStale?: boolean;
    report?: Record<string, unknown> | null;
    reportStale?: boolean;
  } | null;
  personalItems?: {
    report?: Record<string, unknown> | null;
    reportStale?: boolean;
  } | null;
};

export type {
  CountByKey,
  ErrorWithCode,
  GeneratedOutfitSetLike,
  ImageAssetLike,
  JsonSchema,
  JsonSchemaFormat,
  LogContextLike,
  LlmGenerateOptions,
  LlmUsageLike,
  LlmUsageSummary,
  ParsedGenerationError,
  PartialRegenerationJobState,
  StoredWardrobePayloadLike,
  SwimwearCandidate,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeJobState,
  WardrobePdfBuildChildOptions,
  WardrobePdfJobState,
  WardrobeUiItemLike,
  ProfileWithItemsLike,
};
export type {
  PromptDebugImageCategory,
  PromptDebugImageCategoryManifest,
  PromptDebugImageManifest,
  PromptDebugImageResult,
  PromptDebugImageStitched,
  PromptDebugImageStitchedManifest,
  PromptImageAsset,
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimingKey,
  PromptImageTimings,
  PromptImagesChildMessage,
  PromptImagesChildPayload,
  PromptImagesChildSuccessPayload,
  SerializedIpcBuffer,
} from "./promptImageTypes.js";
