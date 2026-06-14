import { hashCapsuleContent } from "../db.js";
import { getCapsule, updateCapsuleReport } from "../capsuleStore.js";
import { getProfile } from "../profileStore.js";
import { getGenerateJsonWithLlm, resolveLlmProvider } from "./llm.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildPromptDebugImagesForCategory } from "./promptImages.js";
import { saveLastPromptArtifacts } from "./regenerateSelectedArtifacts.js";
import type { PromptDebugImageCategory } from "./types.js";

type CapsuleReportJsonGenerator = (
  prompt: string,
  options: Record<string, unknown>,
) => Promise<{ response?: { usage?: unknown }; json: unknown }>;

type CapsuleReportImageWorkSlot = <T>(
  label: string,
  task: () => Promise<T>,
) => Promise<T>;

type CapsuleReportServiceDeps = {
  buildPromptDebugImagesForCategoryImpl: (
    payload: Record<string, unknown>,
  ) => Promise<{ category?: PromptDebugImageCategory | null }>;
  getCapsuleImpl: (email: string, capsuleId: string) => Promise<unknown>;
  getGenerateJsonWithLlmImpl: (profile: unknown) => CapsuleReportJsonGenerator;
  getProfileImpl: (email: string) => Promise<unknown>;
  hashItemsImpl: (value: unknown) => string;
  resolveLlmProviderImpl: (profile: unknown) => {
    model?: unknown;
    provider?: unknown;
  };
  runWithImageWorkSlotImpl: CapsuleReportImageWorkSlot;
  saveLastPromptArtifactsImpl: (payload: Record<string, unknown>) => unknown;
  updateCapsuleReportImpl: (
    email: string,
    capsuleId: string,
    report: unknown,
  ) => Promise<unknown>;
};

type CapsuleReportServiceDepsOverrides = Partial<CapsuleReportServiceDeps>;

const DEFAULT_CAPSULE_REPORT_SERVICE_DEPS: CapsuleReportServiceDeps = {
  buildPromptDebugImagesForCategoryImpl: buildPromptDebugImagesForCategory,
  getCapsuleImpl: getCapsule,
  getGenerateJsonWithLlmImpl: getGenerateJsonWithLlm,
  getProfileImpl: getProfile,
  hashItemsImpl: hashCapsuleContent,
  resolveLlmProviderImpl: resolveLlmProvider,
  runWithImageWorkSlotImpl: runWithImageWorkSlot,
  saveLastPromptArtifactsImpl: saveLastPromptArtifacts,
  updateCapsuleReportImpl: updateCapsuleReport,
};

function createCapsuleReportServiceDeps(
  deps: CapsuleReportServiceDepsOverrides = {},
): CapsuleReportServiceDeps {
  return {
    buildPromptDebugImagesForCategoryImpl:
      deps.buildPromptDebugImagesForCategoryImpl ||
      DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.buildPromptDebugImagesForCategoryImpl,
    getCapsuleImpl:
      deps.getCapsuleImpl || DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.getCapsuleImpl,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl ||
      DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.getGenerateJsonWithLlmImpl,
    getProfileImpl:
      deps.getProfileImpl || DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.getProfileImpl,
    hashItemsImpl:
      deps.hashItemsImpl || DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.hashItemsImpl,
    resolveLlmProviderImpl:
      deps.resolveLlmProviderImpl ||
      DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.resolveLlmProviderImpl,
    runWithImageWorkSlotImpl:
      deps.runWithImageWorkSlotImpl ||
      DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.runWithImageWorkSlotImpl,
    saveLastPromptArtifactsImpl:
      deps.saveLastPromptArtifactsImpl ||
      DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.saveLastPromptArtifactsImpl,
    updateCapsuleReportImpl:
      deps.updateCapsuleReportImpl ||
      DEFAULT_CAPSULE_REPORT_SERVICE_DEPS.updateCapsuleReportImpl,
  };
}

export {
  createCapsuleReportServiceDeps,
  type CapsuleReportJsonGenerator,
  type CapsuleReportServiceDeps,
  type CapsuleReportServiceDepsOverrides,
};
