/* eslint-disable max-lines */
import { hashCapsuleContent } from "../db.js";
import {
  getCapsule,
  getEffectiveCapsuleSnapshot,
  updateCapsuleReport,
} from "../capsuleStore.js";
import { getProfile } from "../profileStore.js";
import { logError } from "../logger.js";
import { extractLlmUsage, logWardrobeInfo } from "./aiCommon.js";
import { getGenerateJsonWithLlm, resolveLlmProvider } from "./llm.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildPromptDebugImagesForCategory } from "./promptImages.js";
import { saveLastPromptArtifacts } from "./regenerateSelectedArtifacts.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import { buildCapsuleReportFormat } from "./capsuleReportSchema.js";
import {
  getOutfitReportPromptItemId,
  toOutfitReportItem,
  toOutfitReportPromptImageItem,
} from "./outfitReportItems.js";
import { applyComputedCapsuleVerdictScore } from "./capsuleReportScoring.js";
import type { CapsuleFilters, CapsuleSnapshot } from "../capsuleStoreModel.js";
import type {
  ImageAssetLike,
  PromptDebugImageCategory,
  PromptImageItemLike,
} from "./types.js";
import type {
  CapsuleReport,
  CapsuleReportGeneratedOutfit,
  CapsuleReportItem,
} from "./capsuleReportTypes.js";
import { parseCapsuleReportLlmOutput } from "./capsuleReportValidation.js";

const CAPSULE_REPORT_SCHEMA_VERSION = 1;
const CAPSULE_REPORT_COLLAGE_CATEGORY = "Current Capsule";
const NO_GENERATED_OUTFITS_MESSAGE =
  "No generated outfit sets were provided for this capsule.";
const CAPSULE_REPORT_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_capsule_report.yaml", import.meta.url),
);
const CAPSULE_REPORT_SYSTEM_PROMPT = getPromptTemplateContent(
  CAPSULE_REPORT_PROMPT_TEMPLATE,
  "system",
);
const CAPSULE_REPORT_USER_PROMPT = getPromptTemplateContent(
  CAPSULE_REPORT_PROMPT_TEMPLATE,
  "user",
);

type CapsuleReportErrorCode =
  | "invalid_payload"
  | "not_found"
  | "service_unavailable";
type CapsuleReportError = Error & {
  code?: CapsuleReportErrorCode;
};
type CapsuleReportContext = {
  capsule: unknown;
  effectiveSnapshot: CapsuleSnapshot;
  generateJsonWithLlm: (
    prompt: string,
    options: Record<string, unknown>,
  ) => Promise<{ response?: { usage?: unknown }; json: unknown }>;
  generatedOutfits: CapsuleReportGeneratedOutfit[];
  items: Record<string, unknown>[];
  normalizedCapsuleId: string;
  profile: unknown;
  reportItems: CapsuleReportItem[];
};

type CapsuleReportServiceDeps = {
  buildPromptDebugImagesForCategoryImpl: (
    payload: Record<string, unknown>,
  ) => Promise<{ category?: PromptDebugImageCategory | null }>;
  getCapsuleImpl: (email: string, capsuleId: string) => Promise<unknown>;
  getGenerateJsonWithLlmImpl: (
    profile: unknown,
  ) => (
    prompt: string,
    options: Record<string, unknown>,
  ) => Promise<{ response?: { usage?: unknown }; json: unknown }>;
  getProfileImpl: (email: string) => Promise<unknown>;
  hashItemsImpl: (value: unknown) => string;
  resolveLlmProviderImpl: (profile: unknown) => {
    model?: unknown;
    provider?: unknown;
  };
  runWithImageWorkSlotImpl: <T>(
    label: string,
    task: () => Promise<T>,
  ) => Promise<T>;
  saveLastPromptArtifactsImpl: (payload: Record<string, unknown>) => unknown;
  updateCapsuleReportImpl: (
    email: string,
    capsuleId: string,
    report: unknown,
  ) => Promise<unknown>;
};
type CapsuleReportServiceDepsOverrides = Partial<CapsuleReportServiceDeps>;

function buildCapsuleReportError(
  code: CapsuleReportErrorCode,
  message: string = code,
): CapsuleReportError {
  const error = new Error(message) as CapsuleReportError;
  error.code = code;
  return error;
}

function getCurrentCapsuleCollageImage(
  currentCapsuleCollage: PromptDebugImageCategory | null | undefined,
): ImageAssetLike | null {
  const buffer = Buffer.isBuffer(currentCapsuleCollage?.buffer)
    ? currentCapsuleCollage.buffer
    : currentCapsuleCollage?.buffer instanceof Uint8Array
      ? Buffer.from(currentCapsuleCollage.buffer)
      : null;

  if (!buffer) return null;
  return {
    buffer,
    mimeType: currentCapsuleCollage?.mimeType || "image/jpeg",
    filename: "current-capsule.jpg",
    category: CAPSULE_REPORT_COLLAGE_CATEGORY,
  };
}

function formatPromptText(value: unknown, fallback = "Not specified") {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function formatPromptList(value: unknown, fallback = "Not specified") {
  return Array.isArray(value) && value.length > 0
    ? value
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .join(", ") || fallback
    : fallback;
}

function formatPromptPattern(value: unknown) {
  const pattern = formatPromptText(value, "Not specified");
  return pattern.toLowerCase() === "solid" ? "solid (no print)" : pattern;
}

function buildAdditionalInfoBlock(filters: CapsuleFilters) {
  const text = typeof filters.text === "string" ? filters.text.trim() : "";
  return text ? `Important Additional Information: ${text}` : "";
}

function renderGeneratedOutfits(
  generatedOutfits: CapsuleReportGeneratedOutfit[],
) {
  return generatedOutfits.length > 0
    ? JSON.stringify(generatedOutfits, null, 2)
    : NO_GENERATED_OUTFITS_MESSAGE;
}

function renderCapsuleReportPrompt({
  filters,
  generatedOutfits,
  reportItems,
}: {
  filters: CapsuleFilters;
  generatedOutfits: CapsuleReportGeneratedOutfit[];
  reportItems: CapsuleReportItem[];
}) {
  return renderPromptTemplateContent(
    CAPSULE_REPORT_USER_PROMPT,
    {
      audience: formatPromptText(filters.audience, "any"),
      occasions: formatPromptList(filters.occasions),
      season: formatPromptList(filters.season),
      formality_level: formatPromptText(filters.formalityLevel),
      style: formatPromptText(filters.style),
      color: formatPromptText(filters.color, "No accent color provided"),
      pattern: formatPromptPattern(filters.pattern),
      additional_info_block: buildAdditionalInfoBlock(filters),
      items: JSON.stringify(reportItems, null, 2),
      generated_outfits: renderGeneratedOutfits(generatedOutfits),
    },
    "capsule report prompt",
  );
}

async function buildCapsuleReportCollage({
  deps,
  items,
}: {
  deps: CapsuleReportServiceDeps;
  items: Record<string, unknown>[];
}): Promise<ImageAssetLike> {
  const promptItems = items
    .map(toOutfitReportPromptImageItem)
    .filter((item): item is PromptImageItemLike => Boolean(item));
  const promptDebugImages = await deps.runWithImageWorkSlotImpl(
    "capsule-report-images",
    () =>
      deps.buildPromptDebugImagesForCategoryImpl({
        category: CAPSULE_REPORT_COLLAGE_CATEGORY,
        compactRows: true,
        items: promptItems,
      }),
  );
  const collage = getCurrentCapsuleCollageImage(promptDebugImages?.category);
  if (!collage) {
    throw buildCapsuleReportError("service_unavailable", "missing_collage");
  }
  return collage;
}

function createCapsuleReportServiceDeps(
  deps: CapsuleReportServiceDepsOverrides = {},
): CapsuleReportServiceDeps {
  return {
    buildPromptDebugImagesForCategoryImpl:
      deps.buildPromptDebugImagesForCategoryImpl ||
      buildPromptDebugImagesForCategory,
    getCapsuleImpl: deps.getCapsuleImpl || getCapsule,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl || getGenerateJsonWithLlm,
    getProfileImpl: deps.getProfileImpl || getProfile,
    hashItemsImpl: deps.hashItemsImpl || hashCapsuleContent,
    resolveLlmProviderImpl: deps.resolveLlmProviderImpl || resolveLlmProvider,
    runWithImageWorkSlotImpl:
      deps.runWithImageWorkSlotImpl || runWithImageWorkSlot,
    saveLastPromptArtifactsImpl:
      deps.saveLastPromptArtifactsImpl || saveLastPromptArtifacts,
    updateCapsuleReportImpl:
      deps.updateCapsuleReportImpl || updateCapsuleReport,
  };
}

function normalizeCapsuleReportId(capsuleId: string) {
  const normalizedCapsuleId = String(capsuleId || "").trim();
  if (!normalizedCapsuleId) {
    throw buildCapsuleReportError("invalid_payload");
  }
  return normalizedCapsuleId;
}

function getRequiredEffectiveSnapshot(capsule: unknown) {
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(
    capsule as Record<string, unknown>,
  );
  if (!effectiveSnapshot) {
    throw buildCapsuleReportError("invalid_payload", "empty_capsule");
  }
  return effectiveSnapshot;
}

function getRequiredCapsuleItems(snapshot: CapsuleSnapshot) {
  const items = snapshot.data?.wardrobe?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw buildCapsuleReportError("invalid_payload", "empty_capsule");
  }
  return items as Record<string, unknown>[];
}

function getRequiredReportItems(items: Record<string, unknown>[]) {
  const reportItems = items
    .map((item) => toOutfitReportItem(item))
    .filter((item): item is CapsuleReportItem => Boolean(item));
  if (reportItems.length !== items.length) {
    throw buildCapsuleReportError("invalid_payload", "missing_item_id");
  }
  return reportItems;
}

function getRawItemId(item: Record<string, unknown>) {
  const id = item.id;
  return typeof id === "string" || typeof id === "number"
    ? String(id).trim()
    : "";
}

function buildPromptItemIdMap(items: Record<string, unknown>[]) {
  const itemIdMap = new Map<string, string>();
  for (const item of items) {
    const rawId = getRawItemId(item);
    const promptId = getOutfitReportPromptItemId(item);
    if (rawId && promptId) {
      itemIdMap.set(rawId, promptId);
      itemIdMap.set(promptId, promptId);
    }
  }
  return itemIdMap;
}

function mapGeneratedOutfitItemIds(
  itemIds: unknown,
  itemIdMap: Map<string, string>,
) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw buildCapsuleReportError(
      "invalid_payload",
      "unresolved_generated_outfit_items",
    );
  }

  return itemIds.map((itemId) => {
    const mappedId = itemIdMap.get(String(itemId || "").trim());
    if (!mappedId) {
      throw buildCapsuleReportError(
        "invalid_payload",
        "unresolved_generated_outfit_items",
      );
    }
    return mappedId;
  });
}

function buildGeneratedOutfits({
  itemIdMap,
  snapshot,
}: {
  itemIdMap: Map<string, string>;
  snapshot: CapsuleSnapshot;
}) {
  const outfitSets = snapshot.data?.wardrobe?.outfitSets;
  return Array.isArray(outfitSets)
    ? outfitSets.map((outfitSet, index) => ({
        id: `outfit-set-${index + 1}`,
        itemIds: mapGeneratedOutfitItemIds(outfitSet?.itemIds, itemIdMap),
      }))
    : [];
}

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
    capsule,
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

function isCapsuleReportDomainError(error: unknown) {
  return ["service_unavailable", "invalid_payload", "not_found"].includes(
    String((error as CapsuleReportError).code),
  );
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
