import type { ImageAssetLike, LlmUsageLike, UserProfileLike } from "./types.js";

type CapsuleSelectionResponse = {
  output_text?: string | null;
  output?: unknown;
  output_parsed?: unknown;
  status?: string | null;
  incomplete_details?: unknown;
  usage?: LlmUsageLike | null;
};

type CapsuleSelectionJson = {
  capsule?: unknown;
  outfit_formulas?: unknown;
  system_evaluation?: {
    short_capsule_name?: unknown;
  } | null;
};

type CapsuleGenerateJsonWithLlm = (
  prompt: string,
  options: {
    userProfile?: UserProfileLike | null;
    images?: ImageAssetLike[];
    onPayloadBuilt?: (() => void) | null;
  },
) => Promise<{
  response?: CapsuleSelectionResponse | null;
  json?: CapsuleSelectionJson | null;
}>;

type LlmProviderResolutionLike = {
  requestedLlm: string;
  provider?: string | null;
  model?: string | null;
  fallbackReason?: string | null;
};

type ValidatedCapsuleAnchorsLike = {
  anchorWardrobeNumericIds: number[];
  anchorCatalogUrls: string[];
  anchorItemRefs: NonNullable<UserProfileLike["anchorItemRefs"]>;
  anchorItems: Array<Record<string, unknown>>;
};

type CapsuleWardrobeSqlParamsLike = Record<string, unknown>;
type CapsuleWardrobeSqlResultLike =
  Array<Record<string, unknown>> | { count: number };

export type {
  CapsuleGenerateJsonWithLlm,
  CapsuleSelectionJson,
  CapsuleSelectionResponse,
  CapsuleWardrobeSqlParamsLike,
  CapsuleWardrobeSqlResultLike,
  LlmProviderResolutionLike,
  ValidatedCapsuleAnchorsLike,
};
