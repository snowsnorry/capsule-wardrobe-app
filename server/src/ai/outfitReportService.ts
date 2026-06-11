import { hashCapsuleContent } from "../db.js";
import { getOutfitItems } from "../outfitHttp.js";
import {
  getEffectiveOutfitSnapshot,
  getOutfit,
  updateOutfitReport,
} from "../outfitStore.js";
import { getProfile } from "../profileStore.js";
import { logError } from "../logger.js";
import { extractLlmUsage, logWardrobeInfo } from "./aiCommon.js";
import { getGenerateJsonWithLlm, resolveLlmProvider } from "./llm.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
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
import type {
  ImageAssetLike,
  PromptDebugImageResult,
  PromptImageItemLike,
} from "./types.js";
import type {
  OutfitReport,
  OutfitReportItem,
  OutfitReportLlmOutput,
} from "./outfitReportTypes.js";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OutfitReportServiceDeps = Record<string, any>;

function buildOutfitReportError(
  code: OutfitReportErrorCode,
  message: string = code,
): OutfitReportError {
  const error = new Error(message) as OutfitReportError;
  error.code = code;
  return error;
}

function getStitchedCollageImage(
  promptDebugImages: PromptDebugImageResult,
): ImageAssetLike | null {
  const stitched = promptDebugImages.stitched;
  const buffer = Buffer.isBuffer(stitched?.buffer)
    ? stitched.buffer
    : stitched?.buffer instanceof Uint8Array
      ? Buffer.from(stitched.buffer)
      : null;

  return buffer
    ? {
        buffer,
        mimeType: stitched?.mimeType || "image/jpeg",
        filename: stitched?.filename || "outfit-report-collage.jpg",
        category: "outfit-report",
      }
    : null;
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
      deps.buildPromptDebugImagesInChildImpl({
        normalizedItems: promptItems,
        saveDebugArtifacts: false,
      }),
  );
  const collage = getStitchedCollageImage(promptDebugImages);
  if (!collage) {
    throw buildOutfitReportError("service_unavailable", "missing_collage");
  }
  return collage;
}

function finalizeReport({
  parsedReport,
  itemsHash,
}: {
  parsedReport: OutfitReportLlmOutput;
  itemsHash: string;
}): OutfitReport {
  return {
    ...parsedReport,
    schemaVersion: OUTFIT_REPORT_SCHEMA_VERSION,
    itemsHash,
  };
}

function createOutfitReportServiceDeps(
  deps: OutfitReportServiceDeps = {},
): OutfitReportServiceDeps {
  return {
    buildPromptDebugImagesInChildImpl:
      deps.buildPromptDebugImagesInChildImpl || buildPromptDebugImagesInChild,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl || getGenerateJsonWithLlm,
    getOutfitImpl: deps.getOutfitImpl || getOutfit,
    getOutfitItemsImpl: deps.getOutfitItemsImpl || getOutfitItems,
    getProfileImpl: deps.getProfileImpl || getProfile,
    hashItemsImpl: deps.hashItemsImpl || hashCapsuleContent,
    resolveLlmProviderImpl: deps.resolveLlmProviderImpl || resolveLlmProvider,
    runWithImageWorkSlotImpl:
      deps.runWithImageWorkSlotImpl || runWithImageWorkSlot,
    updateOutfitReportImpl: deps.updateOutfitReportImpl || updateOutfitReport,
    ...deps,
  };
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
  const report = finalizeReport({ parsedReport, itemsHash });
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
  const code = (error as OutfitReportError).code;
  return (
    code === "service_unavailable" ||
    code === "invalid_payload" ||
    code === "not_found"
  );
}

async function generateOutfitReport(
  email: string,
  outfitId: string,
  deps: OutfitReportServiceDeps = {},
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
