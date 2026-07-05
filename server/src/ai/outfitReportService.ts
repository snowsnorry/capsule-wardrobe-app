import { getEffectiveOutfitSnapshot } from "../outfitStore.js";
import { logError } from "../logger.js";
import { extractLlmUsage, logWardrobeInfo } from "./aiCommon.js";
import {
  buildOutfitReportError,
  isOutfitReportDomainError,
} from "./outfitReportErrors.js";
import {
  OUTFIT_REPORT_SYSTEM_PROMPT,
  buildOutfitReportCollage,
  renderOutfitReportPrompt,
} from "./outfitReportPrompt.js";
import { buildOutfitReportFormat } from "./outfitReportSchema.js";
import { toOutfitReportItem } from "./outfitReportItems.js";
import { applyComputedVerdictScore } from "./outfitReportScoring.js";
import {
  createOutfitReportServiceDeps,
  type OutfitReportServiceDeps,
  type OutfitReportServiceDepsOverrides,
} from "./outfitReportServiceDeps.js";
import type { OutfitReport, OutfitReportItem } from "./outfitReportTypes.js";
import { parseOutfitReportLlmOutput } from "./outfitReportValidation.js";
import { throwIfAborted } from "./abortSignal.js";

const OUTFIT_REPORT_SCHEMA_VERSION = 1;

type OutfitReportContext = {
  generateJsonWithLlm: (
    prompt: string,
    options: Record<string, unknown>,
  ) => Promise<{ response?: { usage?: unknown }; json: unknown }>;
  itemRefs: unknown[];
  items: Record<string, unknown>[];
  normalizedOutfitId: string;
  profile: unknown;
  reportItems: OutfitReportItem[];
};

function normalizeOutfitReportId(outfitId: string) {
  const normalizedOutfitId = String(outfitId || "").trim();
  if (!normalizedOutfitId) {
    throw buildOutfitReportError("invalid_payload");
  }
  return normalizedOutfitId;
}

async function getRequiredOutfit({
  deps,
  email,
  normalizedOutfitId,
}: {
  deps: OutfitReportServiceDeps;
  email: string;
  normalizedOutfitId: string;
}) {
  const outfit = await deps.getOutfitImpl(email, normalizedOutfitId);
  if (!outfit) {
    throw buildOutfitReportError("not_found");
  }
  return outfit;
}

function getRequiredItemRefs(outfit: unknown) {
  const effectiveSnapshot = getEffectiveOutfitSnapshot(
    outfit as Record<string, unknown>,
  );
  const itemRefs = Array.isArray(effectiveSnapshot?.items)
    ? effectiveSnapshot.items
    : [];
  if (itemRefs.length === 0) {
    throw buildOutfitReportError("invalid_payload", "empty_outfit");
  }
  return itemRefs;
}

async function getProfileAndOutfitItems({
  deps,
  email,
  outfit,
}: {
  deps: OutfitReportServiceDeps;
  email: string;
  outfit: unknown;
}) {
  const [profile, items] = await Promise.all([
    deps.getProfileImpl(email),
    deps.getOutfitItemsImpl(outfit, {
      email,
      getProductsByUrlsForEmailImpl: deps.getProductsByUrlsForEmailImpl,
      listWardrobeItemsByUrlsImpl: deps.listWardrobeItemsByUrlsImpl,
    }),
  ]);
  return { profile, items };
}

function getRequiredHydratedItems(items: unknown, itemRefs: unknown[]) {
  if (!Array.isArray(items) || items.length !== itemRefs.length) {
    throw buildOutfitReportError("invalid_payload", "unresolved_outfit_items");
  }
  return items as Record<string, unknown>[];
}

function getRequiredReportItems(items: Record<string, unknown>[]) {
  const reportItems = items
    .map((item) => toOutfitReportItem(item))
    .filter((item): item is OutfitReportItem => Boolean(item));
  if (reportItems.length !== items.length) {
    throw buildOutfitReportError("invalid_payload", "missing_item_id");
  }
  return reportItems;
}

function getRequiredReportGenerator({
  deps,
  profile,
}: {
  deps: OutfitReportServiceDeps;
  profile: unknown;
}): OutfitReportContext["generateJsonWithLlm"] {
  const generateJsonWithLlm = deps.getGenerateJsonWithLlmImpl(profile);
  if (!generateJsonWithLlm) {
    throw buildOutfitReportError("service_unavailable", "llm_unavailable");
  }
  return generateJsonWithLlm;
}

async function buildOutfitReportContext({
  deps,
  email,
  outfitId,
}: {
  deps: OutfitReportServiceDeps;
  email: string;
  outfitId: string;
}): Promise<OutfitReportContext> {
  const normalizedOutfitId = normalizeOutfitReportId(outfitId);
  const outfit = await getRequiredOutfit({ deps, email, normalizedOutfitId });
  const itemRefs = getRequiredItemRefs(outfit);
  const { profile, items } = await getProfileAndOutfitItems({
    deps,
    email,
    outfit,
  });
  const hydratedItems = getRequiredHydratedItems(items, itemRefs);
  return {
    generateJsonWithLlm: getRequiredReportGenerator({ deps, profile }),
    itemRefs,
    items: hydratedItems,
    normalizedOutfitId,
    profile,
    reportItems: getRequiredReportItems(hydratedItems),
  };
}

async function generateAndPersistReport({
  context,
  deps,
  email,
  signal,
}: {
  context: OutfitReportContext;
  deps: OutfitReportServiceDeps;
  email: string;
  signal?: AbortSignal | null;
}) {
  throwIfAborted(signal);
  const { normalizedOutfitId, profile, reportItems } = context;
  const collage = await buildOutfitReportCollage({
    items: context.items,
    deps,
  });
  throwIfAborted(signal);
  const prompt = renderOutfitReportPrompt(reportItems);
  deps.saveLastPromptArtifactsImpl({
    prompt,
    userProfile: profile,
    systemPrompt: OUTFIT_REPORT_SYSTEM_PROMPT,
    currentOutfitCollage: collage,
  });
  const itemsHash = deps.hashItemsImpl(context.itemRefs);
  const llmResolution = deps.resolveLlmProviderImpl(profile);
  const startedAt = Date.now();
  const { response, json } = await context.generateJsonWithLlm(prompt, {
    userProfile: profile,
    format: buildOutfitReportFormat(),
    images: [collage],
    signal,
    systemPrompt: OUTFIT_REPORT_SYSTEM_PROMPT,
  });
  throwIfAborted(signal);
  const parsedReport = parseOutfitReportLlmOutput(json, {
    itemCount: reportItems.length,
    itemIds: reportItems.map((item) => item.id),
  });
  const report: OutfitReport = {
    ...applyComputedVerdictScore(parsedReport),
    schemaVersion: OUTFIT_REPORT_SCHEMA_VERSION,
    itemsHash,
  };
  const updatedOutfit = await deps.updateOutfitReportImpl(
    email,
    normalizedOutfitId,
    report,
  );
  if (!updatedOutfit) {
    throw buildOutfitReportError("not_found");
  }
  logWardrobeInfo("outfit-report-completed", {
    outfitId: normalizedOutfitId,
    itemCount: reportItems.length,
    llmProvider: llmResolution?.provider,
    llmModel: llmResolution?.model,
    llmDurationMs: Date.now() - startedAt,
    ...extractLlmUsage(response?.usage),
  });
  return report;
}

async function generateOutfitReport(
  email: string,
  outfitId: string,
  deps: OutfitReportServiceDepsOverrides = {},
  options: { signal?: AbortSignal | null } = {},
): Promise<OutfitReport> {
  const resolvedDeps = createOutfitReportServiceDeps(deps);
  const context = await buildOutfitReportContext({
    deps: resolvedDeps,
    email,
    outfitId,
  });
  try {
    return await generateAndPersistReport({
      context,
      deps: resolvedDeps,
      email,
      signal: options.signal,
    });
  } catch (error) {
    if (isOutfitReportDomainError(error)) throw error;
    logError("[outfit-report]", {
      outfitId: context.normalizedOutfitId,
      message: error instanceof Error ? error.message : "unknown_error",
      code: (error as { code?: string })?.code ?? null,
    });
    throw buildOutfitReportError("service_unavailable");
  }
}

export { generateOutfitReport };
