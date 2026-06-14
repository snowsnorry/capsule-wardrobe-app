import {
  getProductsByUrlsForEmailInOrder,
  getSqlClient,
  listWardrobeItemsByIdsForEmail,
} from "../db.js";
import { validateCapsuleAnchorItems } from "../capsuleAnchors.js";
import {
  getGenerateJsonWithLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llm.js";
import { getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItemsForProfile,
} from "./aiSql.js";
import type { CountByKey } from "./types.js";
import type { UserProfileLike } from "./types.js";
import type {
  CapsuleGenerateJsonWithLlm,
  CapsuleWardrobeSqlParamsLike,
  CapsuleWardrobeSqlResultLike,
  LlmProviderResolutionLike,
  ValidatedCapsuleAnchorsLike,
} from "./aiGenerationTypes.js";

type CapsuleGenerationDeps = {
  buildCapsuleWardrobeSqlParamsImpl?: (
    userProfile: UserProfileLike | null,
    promptEmbeddings: number[],
    capsuleCategories: CountByKey,
  ) => CapsuleWardrobeSqlParamsLike;
  buildPromptDebugImagesInChildImpl?: typeof buildPromptDebugImagesInChild;
  getGenerateJsonWithLlmImpl?: (
    userProfile: UserProfileLike | null,
  ) => CapsuleGenerateJsonWithLlm | null;
  getPromptEmbeddingsImpl?: (prompt: string) => Promise<number[]>;
  getWardrobePromptImpl?: (userProfile: UserProfileLike | null) => string;
  isNoLlmProfileEnabledImpl?: (userProfile: UserProfileLike | null) => boolean;
  queryCapsuleWardrobeItemsForProfileImpl?: (
    sql: unknown,
    params: CapsuleWardrobeSqlParamsLike,
  ) => Promise<CapsuleWardrobeSqlResultLike>;
  resolveLlmProviderImpl?: (
    userProfile: UserProfileLike | null,
  ) => LlmProviderResolutionLike;
  runWithImageWorkSlotImpl?: typeof runWithImageWorkSlot;
  getSqlClientImpl?: () => unknown;
  validateCapsuleAnchorItemsImpl?: (
    email: string,
    anchorItemRefs: UserProfileLike["anchorItemRefs"],
  ) => Promise<ValidatedCapsuleAnchorsLike>;
};

type ResolvedCapsuleGenerationDeps = Required<CapsuleGenerationDeps>;

function validateAnchorsForProfile(
  email: string,
  anchorItemRefs: UserProfileLike["anchorItemRefs"],
) {
  return validateCapsuleAnchorItems({
    email,
    anchorItemRefs,
    deps: {
      listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
      getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
    },
  });
}

const DEFAULT_CAPSULE_GENERATION_DEPS: ResolvedCapsuleGenerationDeps = {
  buildCapsuleWardrobeSqlParamsImpl: buildCapsuleWardrobeSqlParams,
  buildPromptDebugImagesInChildImpl: buildPromptDebugImagesInChild,
  getGenerateJsonWithLlmImpl: getGenerateJsonWithLlm,
  getPromptEmbeddingsImpl: getPromptEmbeddings,
  getWardrobePromptImpl: getWardrobePrompt,
  isNoLlmProfileEnabledImpl: isNoLlmProfileEnabled,
  queryCapsuleWardrobeItemsForProfileImpl: queryCapsuleWardrobeItemsForProfile,
  resolveLlmProviderImpl: resolveLlmProvider,
  runWithImageWorkSlotImpl: runWithImageWorkSlot,
  getSqlClientImpl: getSqlClient,
  validateCapsuleAnchorItemsImpl: validateAnchorsForProfile,
};

function getDefinedCapsuleGenerationOverrides(deps: CapsuleGenerationDeps) {
  return Object.fromEntries(
    Object.entries(deps).filter(([, value]) => value !== undefined),
  ) as CapsuleGenerationDeps;
}

function createCapsuleGenerationDeps(
  deps: CapsuleGenerationDeps = {},
): ResolvedCapsuleGenerationDeps {
  return {
    ...DEFAULT_CAPSULE_GENERATION_DEPS,
    ...getDefinedCapsuleGenerationOverrides(deps),
  } as ResolvedCapsuleGenerationDeps;
}

export { createCapsuleGenerationDeps };
export type { CapsuleGenerationDeps, ResolvedCapsuleGenerationDeps };
