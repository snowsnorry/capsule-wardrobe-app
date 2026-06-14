import { getEffectiveOutfitSnapshot } from "../outfitStore.js";
import { logError } from "../logger.js";
import { extractLlmUsage, logWardrobeInfo } from "./aiCommon.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import { buildOutfitReportFormat } from "./outfitReportSchema.js";
import {
  toOutfitReportItem,
  toOutfitReportPromptImageItem,
} from "./outfitReportItems.js";
import { applyComputedVerdictScore } from "./outfitReportScoring.js";
import type {
  ImageAssetLike,
  PromptDebugImageCategory,
  PromptImageItemLike,
} from "./types.js";
import {
  createOutfitReportServiceDeps,
  type OutfitReportServiceDeps,
  type OutfitReportServiceDepsOverrides,
} from "./outfitReportServiceDeps.js";
import type { OutfitReport, OutfitReportItem } from "./outfitReportTypes.js";
import { parseOutfitReportLlmOutput } from "./outfitReportValidation.js";

const OUTFIT_REPORT_SCHEMA_VERSION = 1;
const OUTFIT_REPORT_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_outfit_report.yaml", import.meta.url),
);
const OUTFIT_REPORT_SYSTEM_PROMPT = getPromptTemplateContent(
  OUTFIT_REPORT_PROMPT_TEMPLATE,
  "system",
);
const OUTFIT_REPORT_USER_PROMPT = getPromptTemplateContent(
  OUTFIT_REPORT_PROMPT_TEMPLATE,
  "user",
);

type OutfitReportErrorCode =
  | "invalid_payload"
  | "not_found"
  | "service_unavailable";
type OutfitReportError = Error & {
  code?: OutfitReportErrorCode;
};
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

function buildOutfitReportError(
  code: OutfitReportErrorCode,
  message: string = code,
): OutfitReportError {
  const error = new Error(message) as OutfitReportError;
  error.code = code;
  return error;
}

function getCurrentOutfitCollageImage(
  currentOutfitCollage: PromptDebugImageCategory | null | undefined,
): ImageAssetLike | null {
  const buffer = Buffer.isBuffer(currentOutfitCollage?.buffer)
    ? currentOutfitCollage.buffer
    : currentOutfitCollage?.buffer instanceof Uint8Array
      ? Buffer.from(currentOutfitCollage.buffer)
      : null;

  if (!buffer) return null;
  return {
    buffer,
    mimeType: currentOutfitCollage?.mimeType || "image/jpeg",
    filename: "current-outfit.jpg",
    category: "Current Outfit",
  };
}

function renderOutfitReportPrompt(items: OutfitReportItem[]) {
  return renderPromptTemplateContent(
    OUTFIT_REPORT_USER_PROMPT,
    {
      items: JSON.stringify(items, null, 2),
    },
    "outfit report prompt",
  );
}

async function buildOutfitReportCollage({
  items,
  deps,
}: {
  items: Record<string, unknown>[];
  deps: OutfitReportServiceDeps;
}): Promise<ImageAssetLike> {
  const promptItems = items
    .map(toOutfitReportPromptImageItem)
    .filter((item): item is PromptImageItemLike => Boolean(item));
  const promptDebugImages = await deps.runWithImageWorkSlotImpl(
    "outfit-report-images",
    () =>
      deps.buildPromptDebugImagesForCategoryImpl({
        category: "Current Outfit",
        compactRows: true,
        items: promptItems,
      }),
  );
  const collage = getCurrentOutfitCollageImage(promptDebugImages?.category);
  if (!collage) {
    throw buildOutfitReportError("service_unavailable", "missing_collage");
  }
  return collage;
}

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
}: {
  context: OutfitReportContext;
  deps: OutfitReportServiceDeps;
  email: string;
}) {
  const { normalizedOutfitId, profile, reportItems } = context;
  const collage = await buildOutfitReportCollage({
    items: context.items,
    deps,
  });
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
    systemPrompt: OUTFIT_REPORT_SYSTEM_PROMPT,
  });
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

function isOutfitReportDomainError(error: unknown) {
  return ["service_unavailable", "invalid_payload", "not_found"].includes(
    String((error as OutfitReportError).code),
  );
}

async function generateOutfitReport(
  email: string,
  outfitId: string,
  deps: OutfitReportServiceDepsOverrides = {},
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
