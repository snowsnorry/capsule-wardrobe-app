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

type PromptImagesChildPayload =
  | PromptImagesChildSuccessPayload
  | PromptImagesChildFailurePayload;

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
};
