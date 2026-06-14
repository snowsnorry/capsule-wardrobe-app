import { logError } from "../logger.js";
import { extractLlmUsage, logWardrobeInfo } from "./aiCommon.js";
import { buildCapsuleReportFormat } from "./capsuleReportSchema.js";
import {
  buildCapsuleReportCollage,
  CAPSULE_REPORT_SYSTEM_PROMPT,
  NO_GENERATED_OUTFITS_MESSAGE,
  renderCapsuleReportPrompt,
} from "./capsuleReportPrompt.js";
import {
  buildGeneratedOutfits,
  buildPromptItemIdMap,
  getRequiredCapsuleItems,
  getRequiredEffectiveSnapshot,
  getRequiredReportItems,
  normalizeCapsuleReportId,
} from "./capsuleReportInputs.js";
import {
  buildCapsuleReportError,
  isCapsuleReportDomainError,
} from "./capsuleReportErrors.js";
import {
  createCapsuleReportServiceDeps,
  type CapsuleReportJsonGenerator,
  type CapsuleReportServiceDeps,
  type CapsuleReportServiceDepsOverrides,
} from "./capsuleReportServiceDeps.js";
import { applyComputedCapsuleVerdictScore } from "./capsuleReportScoring.js";
import type { CapsuleSnapshot } from "../capsuleStoreModel.js";
import type {
  CapsuleReport,
  CapsuleReportGeneratedOutfit,
  CapsuleReportItem,
} from "./capsuleReportTypes.js";
import { parseCapsuleReportLlmOutput } from "./capsuleReportValidation.js";

const CAPSULE_REPORT_SCHEMA_VERSION = 1;

type CapsuleReportContext = {
  effectiveSnapshot: CapsuleSnapshot;
  generateJsonWithLlm: CapsuleReportJsonGenerator;
  generatedOutfits: CapsuleReportGeneratedOutfit[];
  items: Record<string, unknown>[];
  normalizedCapsuleId: string;
  profile: unknown;
  reportItems: CapsuleReportItem[];
};

async function getRequiredCapsule({
  deps,
  email,
  normalizedCapsuleId,
}: {
  deps: CapsuleReportServiceDeps;
  email: string;
  normalizedCapsuleId: string;
}) {
  const capsule = await deps.getCapsuleImpl(email, normalizedCapsuleId);
  if (!capsule) {
    throw buildCapsuleReportError("not_found");
  }
  return capsule;
}

function getRequiredReportGenerator({
  deps,
  profile,
}: {
  deps: CapsuleReportServiceDeps;
  profile: unknown;
}): CapsuleReportContext["generateJsonWithLlm"] {
  const generateJsonWithLlm = deps.getGenerateJsonWithLlmImpl(profile);
  if (!generateJsonWithLlm) {
    throw buildCapsuleReportError("service_unavailable", "llm_unavailable");
  }
  return generateJsonWithLlm;
}

async function buildCapsuleReportContext({
  capsuleId,
  deps,
  email,
}: {
  capsuleId: string;
  deps: CapsuleReportServiceDeps;
  email: string;
}): Promise<CapsuleReportContext> {
  const normalizedCapsuleId = normalizeCapsuleReportId(capsuleId);
  const capsule = await getRequiredCapsule({
    deps,
    email,
    normalizedCapsuleId,
  });
  const effectiveSnapshot = getRequiredEffectiveSnapshot(capsule);
  const items = getRequiredCapsuleItems(effectiveSnapshot);
  const reportItems = getRequiredReportItems(items);
  const itemIdMap = buildPromptItemIdMap(items);
  const generatedOutfits = buildGeneratedOutfits({
    itemIdMap,
    snapshot: effectiveSnapshot,
  });
  const profile = await deps.getProfileImpl(email);
  return {
    effectiveSnapshot,
    generateJsonWithLlm: getRequiredReportGenerator({ deps, profile }),
    generatedOutfits,
    items,
    normalizedCapsuleId,
    profile,
    reportItems,
  };
}

function buildReportItemsHash(context: CapsuleReportContext) {
  return context.generatedOutfits.length > 0
    ? context.generatedOutfits
    : NO_GENERATED_OUTFITS_MESSAGE;
}

function hashCapsuleReportInputs(
  context: CapsuleReportContext,
  deps: CapsuleReportServiceDeps,
) {
  return deps.hashItemsImpl({
    filters: context.effectiveSnapshot.filters,
    generatedOutfits: buildReportItemsHash(context),
    items: context.reportItems,
  });
}

async function generateAndPersistReport({
  context,
  deps,
  email,
}: {
  context: CapsuleReportContext;
  deps: CapsuleReportServiceDeps;
  email: string;
}) {
  const collage = await buildCapsuleReportCollage({
    deps,
    items: context.items,
  });
  const prompt = renderCapsuleReportPrompt({
    filters: context.effectiveSnapshot.filters,
    generatedOutfits: context.generatedOutfits,
    reportItems: context.reportItems,
  });
  deps.saveLastPromptArtifactsImpl({
    prompt,
    userProfile: context.profile,
    systemPrompt: CAPSULE_REPORT_SYSTEM_PROMPT,
    currentCapsuleCollage: collage,
  });
  const itemsHash = hashCapsuleReportInputs(context, deps);
  const llmResolution = deps.resolveLlmProviderImpl(context.profile);
  const startedAt = Date.now();
  const { response, json } = await context.generateJsonWithLlm(prompt, {
    userProfile: context.profile,
    format: buildCapsuleReportFormat(),
    images: [collage],
    systemPrompt: CAPSULE_REPORT_SYSTEM_PROMPT,
  });
  const parsedReport = parseCapsuleReportLlmOutput(json, {
    generatedOutfitIds: context.generatedOutfits.map((outfit) => outfit.id),
    itemCount: context.reportItems.length,
    itemIds: context.reportItems.map((item) => item.id),
  });
  const report: CapsuleReport = {
    ...applyComputedCapsuleVerdictScore(parsedReport),
    schemaVersion: CAPSULE_REPORT_SCHEMA_VERSION,
    itemsHash,
  };
  const updatedCapsule = await deps.updateCapsuleReportImpl(
    email,
    context.normalizedCapsuleId,
    report,
  );
  if (!updatedCapsule) {
    throw buildCapsuleReportError("not_found");
  }
  logWardrobeInfo("capsule-report-completed", {
    capsuleId: context.normalizedCapsuleId,
    itemCount: context.reportItems.length,
    generatedOutfitCount: context.generatedOutfits.length,
    llmProvider: llmResolution?.provider,
    llmModel: llmResolution?.model,
    llmDurationMs: Date.now() - startedAt,
    ...extractLlmUsage(response?.usage),
  });
  return report;
}

async function generateCapsuleReport(
  email: string,
  capsuleId: string,
  deps: CapsuleReportServiceDepsOverrides = {},
): Promise<CapsuleReport> {
  const resolvedDeps = createCapsuleReportServiceDeps(deps);
  const context = await buildCapsuleReportContext({
    capsuleId,
    deps: resolvedDeps,
    email,
  });
  try {
    return await generateAndPersistReport({
      context,
      deps: resolvedDeps,
      email,
    });
  } catch (error) {
    if (isCapsuleReportDomainError(error)) throw error;
    logError("[capsule-report]", {
      capsuleId: context.normalizedCapsuleId,
      message: error instanceof Error ? error.message : "unknown_error",
      code: (error as { code?: string })?.code ?? null,
    });
    throw buildCapsuleReportError("service_unavailable");
  }
}

export { generateCapsuleReport };
