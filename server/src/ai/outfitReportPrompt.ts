import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import { toOutfitReportPromptImageItem } from "./outfitReportItems.js";
import { buildOutfitReportError } from "./outfitReportErrors.js";
import type { OutfitReportServiceDeps } from "./outfitReportServiceDeps.js";
import type { OutfitReportItem } from "./outfitReportTypes.js";
import type {
  ImageAssetLike,
  PromptDebugImageCategory,
  PromptImageItemLike,
} from "./types.js";

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

function getCurrentOutfitCollageImage(
  currentOutfitCollage: PromptDebugImageCategory | null | undefined,
): ImageAssetLike | null {
  const buffer = Buffer.isBuffer(currentOutfitCollage?.buffer)
    ? currentOutfitCollage.buffer
    : currentOutfitCollage?.buffer instanceof Uint8Array
      ? Buffer.from(currentOutfitCollage.buffer)
      : null;

  if (!buffer || buffer.length === 0) return null;
  return {
    buffer,
    mimeType: currentOutfitCollage?.mimeType || "image/jpeg",
    filename: "current-outfit.jpg",
    category: "Current Outfit",
  };
}

function hasUsablePromptImageUrl(
  item: PromptImageItemLike | null,
): item is PromptImageItemLike {
  return (
    Boolean(item) &&
    typeof item?.imageUrl === "string" &&
    item.imageUrl.trim().length > 0
  );
}

function hasLoadedCollageImage(
  category: PromptDebugImageCategory | null | undefined,
) {
  return (
    Number(category?.cachedCount || 0) +
      Number(category?.downloadedCount || 0) >
    0
  );
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
    .filter(hasUsablePromptImageUrl);
  if (promptItems.length === 0) {
    throw buildOutfitReportError("service_unavailable", "missing_collage");
  }
  const promptDebugImages = await deps.runWithImageWorkSlotImpl(
    "outfit-report-images",
    () =>
      deps.buildPromptDebugImagesForCategoryImpl({
        category: "Current Outfit",
        compactRows: true,
        items: promptItems,
      }),
  );
  if (!hasLoadedCollageImage(promptDebugImages?.category)) {
    throw buildOutfitReportError("service_unavailable", "missing_collage");
  }
  const collage = getCurrentOutfitCollageImage(promptDebugImages?.category);
  if (!collage) {
    throw buildOutfitReportError("service_unavailable", "missing_collage");
  }
  return collage;
}

export {
  OUTFIT_REPORT_SYSTEM_PROMPT,
  buildOutfitReportCollage,
  getCurrentOutfitCollageImage,
  renderOutfitReportPrompt,
};
