import { hashCapsuleContent } from "../db.js";
import { getOutfitItems } from "../outfitHttp.js";
import { getOutfit, updateOutfitReport } from "../outfitStore.js";
import { getProfile } from "../profileStore.js";
import { getGenerateJsonWithLlm, resolveLlmProvider } from "./llm.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildPromptDebugImagesForCategory } from "./promptImages.js";
import { saveLastPromptArtifacts } from "./regenerateSelectedArtifacts.js";
import type { PromptDebugImageCategory } from "./types.js";

type OutfitReportLookupDeps = {
  getProductsByUrlsForEmailImpl?: (payload: {
    email: string;
    urls: string[];
  }) => Promise<Record<string, unknown>[]>;
  listWardrobeItemsByUrlsImpl?: (payload: {
    email: string;
    source: "uploaded" | "from_catalog";
    urls: string[];
  }) => Promise<Record<string, unknown>[]>;
};

type OutfitReportImageWorkSlot = <T>(
  label: string,
  task: () => Promise<T>,
) => Promise<T>;
type OutfitReportServiceDepsBase = {
  buildPromptDebugImagesForCategoryImpl: (
    payload: Record<string, unknown>,
  ) => Promise<{ category?: PromptDebugImageCategory | null }>;
  getGenerateJsonWithLlmImpl: (
    profile: unknown,
  ) => (
    prompt: string,
    options: Record<string, unknown>,
  ) => Promise<{ response?: { usage?: unknown }; json: unknown }>;
  getOutfitImpl: (email: string, outfitId: string) => Promise<unknown>;
  getOutfitItemsImpl: (
    outfit: unknown,
    options: OutfitReportLookupDeps & { email: string },
  ) => Promise<unknown>;
  getProfileImpl: (email: string) => Promise<unknown>;
  hashItemsImpl: (value: unknown) => string;
  resolveLlmProviderImpl: (profile: unknown) => {
    model?: unknown;
    provider?: unknown;
  };
  runWithImageWorkSlotImpl: OutfitReportImageWorkSlot;
  saveLastPromptArtifactsImpl: (payload: Record<string, unknown>) => unknown;
  updateOutfitReportImpl: (
    email: string,
    outfitId: string,
    report: unknown,
  ) => Promise<unknown>;
};

const DEFAULT_OUTFIT_REPORT_SERVICE_DEPS: OutfitReportServiceDepsBase = {
  buildPromptDebugImagesForCategoryImpl: buildPromptDebugImagesForCategory,
  getGenerateJsonWithLlmImpl: getGenerateJsonWithLlm,
  getOutfitImpl: getOutfit,
  getOutfitItemsImpl: getOutfitItems,
  getProfileImpl: getProfile,
  hashItemsImpl: hashCapsuleContent,
  resolveLlmProviderImpl: resolveLlmProvider,
  runWithImageWorkSlotImpl: runWithImageWorkSlot,
  saveLastPromptArtifactsImpl: saveLastPromptArtifacts,
  updateOutfitReportImpl: updateOutfitReport,
};

export type OutfitReportServiceDeps = OutfitReportLookupDeps &
  OutfitReportServiceDepsBase;

export type OutfitReportServiceDepsOverrides =
  Partial<OutfitReportServiceDepsBase> & OutfitReportLookupDeps;

export function createOutfitReportServiceDeps(
  deps: OutfitReportServiceDepsOverrides = {},
): OutfitReportServiceDeps {
  return {
    ...DEFAULT_OUTFIT_REPORT_SERVICE_DEPS,
    ...deps,
  };
}
