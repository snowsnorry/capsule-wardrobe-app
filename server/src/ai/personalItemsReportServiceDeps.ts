import { getProfile } from "../profileStore.js";
import {
  getPersonalItemsReportByEmail,
  listWardrobeItemsByEmail,
  upsertPersonalItemsReportByEmail,
} from "../db.js";
import { getGenerateJsonWithLlm, resolveLlmProvider } from "./llm.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildPromptDebugImagesForCategory } from "./promptImages.js";
import { saveLastPromptArtifacts } from "./regenerateSelectedArtifacts.js";
import type { PromptDebugImageCategory } from "./types.js";

type PersonalItemsReportJsonGenerator = (
  prompt: string,
  options: Record<string, unknown>,
) => Promise<{ response?: { usage?: unknown }; json: unknown }>;

type PersonalItemsReportImageWorkSlot = <T>(
  label: string,
  task: () => Promise<T>,
) => Promise<T>;

type PersonalItemsReportRow = {
  email: string;
  report: Record<string, unknown>;
  personalItemUrls: string[];
  generatedAt: string | Date;
};

type PersonalItemsReportServiceDeps = {
  buildPromptDebugImagesForCategoryImpl: (
    payload: Record<string, unknown>,
  ) => Promise<{ category?: PromptDebugImageCategory | null }>;
  getGenerateJsonWithLlmImpl: (
    profile: unknown,
  ) => PersonalItemsReportJsonGenerator;
  getPersonalItemsReportImpl: (
    email: string,
  ) => Promise<PersonalItemsReportRow | null>;
  getProfileImpl: (email: string) => Promise<unknown>;
  listWardrobeItemsImpl: (payload: {
    email: string;
    source?: "uploaded" | "from_catalog" | null;
  }) => Promise<Array<Record<string, unknown>>>;
  resolveLlmProviderImpl: (profile: unknown) => {
    model?: unknown;
    provider?: unknown;
  };
  runWithImageWorkSlotImpl: PersonalItemsReportImageWorkSlot;
  saveLastPromptArtifactsImpl: (payload: Record<string, unknown>) => unknown;
  upsertPersonalItemsReportImpl: (payload: {
    email: string;
    personalItemUrls: string[];
    report: Record<string, unknown>;
  }) => Promise<PersonalItemsReportRow>;
};

type PersonalItemsReportServiceDepsOverrides =
  Partial<PersonalItemsReportServiceDeps>;

const DEFAULT_PERSONAL_ITEMS_REPORT_SERVICE_DEPS: PersonalItemsReportServiceDeps =
  {
    buildPromptDebugImagesForCategoryImpl: buildPromptDebugImagesForCategory,
    getGenerateJsonWithLlmImpl: getGenerateJsonWithLlm,
    getPersonalItemsReportImpl: getPersonalItemsReportByEmail,
    getProfileImpl: getProfile,
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    resolveLlmProviderImpl: resolveLlmProvider,
    runWithImageWorkSlotImpl: runWithImageWorkSlot,
    saveLastPromptArtifactsImpl: saveLastPromptArtifacts,
    upsertPersonalItemsReportImpl: upsertPersonalItemsReportByEmail,
  };

function createPersonalItemsReportServiceDeps(
  deps: PersonalItemsReportServiceDepsOverrides = {},
): PersonalItemsReportServiceDeps {
  return {
    ...DEFAULT_PERSONAL_ITEMS_REPORT_SERVICE_DEPS,
    ...deps,
  };
}

export {
  createPersonalItemsReportServiceDeps,
  type PersonalItemsReportJsonGenerator,
  type PersonalItemsReportServiceDeps,
  type PersonalItemsReportServiceDepsOverrides,
};
