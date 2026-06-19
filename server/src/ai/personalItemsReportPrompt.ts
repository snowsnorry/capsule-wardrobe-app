import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import { buildPersonalItemsReportError } from "./personalItemsReportErrors.js";
import type { PersonalItemsReportServiceDeps } from "./personalItemsReportServiceDeps.js";
import type { PersonalItemsReportItem } from "./personalItemsReportTypes.js";
import type {
  ImageAssetLike,
  PromptDebugImageCategory,
  PromptImageItemLike,
} from "./types.js";

const PERSONAL_ITEMS_REPORT_COLLAGE_CATEGORY = "Personal Items";
const PERSONAL_ITEMS_REPORT_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_personal_items_report.yaml", import.meta.url),
);
const PERSONAL_ITEMS_REPORT_SYSTEM_PROMPT = getPromptTemplateContent(
  PERSONAL_ITEMS_REPORT_PROMPT_TEMPLATE,
  "system",
);
const PERSONAL_ITEMS_REPORT_USER_PROMPT = getPromptTemplateContent(
  PERSONAL_ITEMS_REPORT_PROMPT_TEMPLATE,
  "user",
);

function getStringField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function getArrayField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function getPersonalItemId(item: Record<string, unknown>) {
  return getStringField(item, "id");
}

function toPersonalItemsReportItem(
  item: Record<string, unknown>,
): PersonalItemsReportItem | null {
  const id = getPersonalItemId(item);
  if (!id) {
    return null;
  }

  return {
    id,
    itemSource: getStringField(item, "source"),
    name: getStringField(item, "name"),
    category: getStringField(item, "category"),
    brand: getStringField(item, "brand"),
    audience: getStringField(item, "audience"),
    season: getArrayField(item, "season"),
    formalityLevel: getArrayField(item, "formalityLevel", "formality_level"),
    style: getArrayField(item, "style"),
    occasions: getArrayField(item, "occasions"),
    colorBase: getArrayField(item, "colorBase", "color_base"),
    pattern: getStringField(item, "pattern"),
    finish: getStringField(item, "finish"),
    composition: getStringField(item, "composition"),
    silhouette: getStringField(item, "silhouette"),
    fit: getStringField(item, "fit"),
    closureType: getArrayField(item, "closureType", "closure_type"),
  };
}

function toPersonalItemsReportPromptImageItem(
  item: Record<string, unknown>,
): PromptImageItemLike | null {
  const id = getPersonalItemId(item);
  if (!id) {
    return null;
  }

  return {
    id,
    category: getStringField(item, "category") || "other",
    imageUrl: getStringField(
      item,
      "imageUrl",
      "image_url",
      "rawImageUrl",
      "raw_image_url",
    ),
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

function getPersonalItemsCollageImage(
  personalItemsCollage: PromptDebugImageCategory | null | undefined,
): ImageAssetLike | null {
  const buffer = Buffer.isBuffer(personalItemsCollage?.buffer)
    ? personalItemsCollage.buffer
    : personalItemsCollage?.buffer instanceof Uint8Array
      ? Buffer.from(personalItemsCollage.buffer)
      : null;

  if (!buffer || buffer.length === 0) return null;
  return {
    buffer,
    mimeType: personalItemsCollage?.mimeType || "image/jpeg",
    filename: "personal-items.jpg",
    category: PERSONAL_ITEMS_REPORT_COLLAGE_CATEGORY,
  };
}

function renderPersonalItemsReportPrompt({
  context,
  items,
}: {
  context?: string | null;
  items: PersonalItemsReportItem[];
}) {
  return renderPromptTemplateContent(
    PERSONAL_ITEMS_REPORT_USER_PROMPT,
    {
      context: String(context || "").trim() || "Not provided.",
      items: JSON.stringify(items, null, 2),
    },
    "personal items report prompt",
  );
}

async function buildPersonalItemsReportCollage({
  deps,
  items,
}: {
  deps: PersonalItemsReportServiceDeps;
  items: Record<string, unknown>[];
}): Promise<ImageAssetLike> {
  const promptItems = items
    .map(toPersonalItemsReportPromptImageItem)
    .filter(hasUsablePromptImageUrl);
  if (promptItems.length === 0) {
    throw buildPersonalItemsReportError(
      "service_unavailable",
      "missing_collage",
    );
  }

  const promptDebugImages = await deps.runWithImageWorkSlotImpl(
    "personal-items-report-images",
    () =>
      deps.buildPromptDebugImagesForCategoryImpl({
        category: PERSONAL_ITEMS_REPORT_COLLAGE_CATEGORY,
        compactRows: true,
        items: promptItems,
      }),
  );
  if (!hasLoadedCollageImage(promptDebugImages?.category)) {
    throw buildPersonalItemsReportError(
      "service_unavailable",
      "missing_collage",
    );
  }

  const collage = getPersonalItemsCollageImage(promptDebugImages?.category);
  if (!collage) {
    throw buildPersonalItemsReportError(
      "service_unavailable",
      "missing_collage",
    );
  }
  return collage;
}

export {
  PERSONAL_ITEMS_REPORT_SYSTEM_PROMPT,
  buildPersonalItemsReportCollage,
  renderPersonalItemsReportPrompt,
  toPersonalItemsReportItem,
};
