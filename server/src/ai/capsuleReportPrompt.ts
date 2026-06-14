import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import { toOutfitReportPromptImageItem } from "./outfitReportItems.js";
import { buildCapsuleReportError } from "./capsuleReportErrors.js";
import type { CapsuleFilters } from "../capsuleStoreModel.js";
import type { CapsuleReportServiceDeps } from "./capsuleReportServiceDeps.js";
import type {
  ImageAssetLike,
  PromptDebugImageCategory,
  PromptImageItemLike,
} from "./types.js";
import type {
  CapsuleReportGeneratedOutfit,
  CapsuleReportItem,
} from "./capsuleReportTypes.js";

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

export {
  buildCapsuleReportCollage,
  CAPSULE_REPORT_COLLAGE_CATEGORY,
  CAPSULE_REPORT_SYSTEM_PROMPT,
  NO_GENERATED_OUTFITS_MESSAGE,
  renderCapsuleReportPrompt,
};
