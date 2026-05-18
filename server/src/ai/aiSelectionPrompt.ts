import { getCapsuleCategories } from "./categories.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";

import {
  formatProfileValues,
  getCategoryListText,
  getCategorySchema,
  normalizePatternValue,
} from "./aiCategoryEnforcement.js";

const CAPSULE_GENERATION_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_capsule_generation.yaml", import.meta.url),
);
const PROMPT_TEMPLATE = getPromptTemplateContent(
  CAPSULE_GENERATION_PROMPT_TEMPLATE,
  "user",
);
const WARDROBE_PREFERENCE_RULES =
  "Wardrobe items are items the user already owns. Prefer wardrobe items over catalog items when they are similarly suitable for the capsule. Preserve capsule quality: category, season, formality, color, style, and outfit compatibility remain the deciding constraints.";

function formatStringOrDefault(value, fallback) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function getSelectionPatternText(userProfile) {
  if (normalizePatternValue(userProfile?.pattern) === "solid") {
    return "solid (no print)";
  }

  return formatStringOrDefault(userProfile?.pattern, "solid (no print)");
}

function getAdditionalInfoBlock(userProfile) {
  const additionalText =
    typeof userProfile?.text === "string" ? userProfile.text.trim() : "";
  return additionalText
    ? `Important Additional Information: ${additionalText}`
    : "";
}

function getWardrobePreferenceRules(userProfile) {
  return userProfile?.sourceMode === "wardrobe_preferred"
    ? WARDROBE_PREFERENCE_RULES
    : "";
}

function getWardrobeSelectionReplacements(userProfile, items, categories) {
  const formalityText = formatStringOrDefault(
    userProfile?.formalityLevel,
    "Not specified",
  );
  const styleText = formatStringOrDefault(userProfile?.style, "Not specified");
  const simplifiedItems = items.map(toPromptItem);

  return {
    formality_level: formalityText,
    style: styleText,
    occasions: formatProfileValues(userProfile?.occasions),
    season: formatProfileValues(userProfile?.season),
    audience: userProfile?.audience || "any",
    color: formatStringOrDefault(
      userProfile?.color,
      "No accent color (keep the capsule fully neutral)",
    ),
    pattern: getSelectionPatternText(userProfile),
    additional_info_block: getAdditionalInfoBlock(userProfile),
    wardrobe_preference_rules: getWardrobePreferenceRules(userProfile),
    anchor_items_block: renderAnchorItemsBlock(userProfile?.anchorItems),
    items: JSON.stringify(simplifiedItems, null, 2),
    category_list: getCategoryListText(categories),
    categories_schema: getCategorySchema(categories),
    num_items: String(
      Object.entries(categories).reduce(
        (sum, [, count]) => sum + Number(count),
        0,
      ),
    ),
  };
}

function renderAnchorItemsBlock(anchorItems = []) {
  if (!Array.isArray(anchorItems) || anchorItems.length === 0) {
    return "";
  }

  return [
    "ANCHOR ITEMS - MANDATORY USER-SELECTED ITEMS",
    "",
    "The following items were selected by the user from My Wardrobe as anchor items.",
    "You must build the capsule around these items.",
    "",
    "Rules:",
    "- Include every anchor item in the final capsule exactly once.",
    "- Do not replace, omit, reinterpret, or modify anchor items.",
    "- Preserve anchor item ids exactly as provided.",
    "- Select additional items only from the candidate items section.",
    "- If an anchor item conflicts with the selected filters, the anchor remains mandatory.",
    "",
    "Anchor items:",
    JSON.stringify(anchorItems.map(toPromptItem), null, 2),
  ].join("\n");
}

function formatItemColorParts(item) {
  return [
    Array.isArray(item?.color_base) ? item.color_base.join(", ") : "",
    typeof item?.pattern === "string" ? item.pattern.trim() : "",
    typeof item?.finish === "string" ? item.finish.trim() : "",
    item?.is_neutral ? "neutral" : "",
  ].filter((value) => value);
}

function getItemValue(item, key, fallback = "") {
  return item?.[key] ?? fallback;
}

function getItemArray(item, key) {
  return Array.isArray(item?.[key]) ? item[key] : [];
}

function toPromptItem(item) {
  return {
    id: getItemValue(item, "id", null),
    item_source: getItemValue(item, "item_source", "catalog"),
    name: getItemValue(item, "name"),
    type: getItemValue(item, "category"),
    color: formatItemColorParts(item).join(", "),
    formality_level: getItemArray(item, "formality_level"),
    style: getItemArray(item, "style"),
    materials: getItemValue(item, "composition"),
    fit: formatStringOrDefault(item?.fit, ""),
    silhouette: formatStringOrDefault(item?.silhouette, ""),
  };
}

export function getWardrobeSelectionPrompt(
  userProfile = null,
  items = [],
  categories = getCapsuleCategories(userProfile),
) {
  return renderPromptTemplateContent(
    PROMPT_TEMPLATE,
    getWardrobeSelectionReplacements(userProfile, items, categories),
    "wardrobe selection prompt",
  );
}

export function toWardrobeUiItem(item) {
  return {
    id: getItemValue(item, "id", null),
    itemSource: getItemValue(item, "item_source", "catalog"),
    url: getItemValue(item, "url"),
    name: getItemValue(item, "name"),
    description: getItemValue(item, "description", null),
    brand: getItemValue(item, "brand", null),
    category: getItemValue(item, "category"),
    imageUrl: getItemValue(item, "image_url"),
    rawImageUrl: getItemValue(item, "raw_image_url", null),
    audience: getItemValue(item, "audience"),
    season: getItemArray(item, "season"),
    formalityLevel: getItemArray(item, "formality_level"),
    style: getItemArray(item, "style"),
    occasions: getItemArray(item, "occasions"),
    colorBase: getItemArray(item, "color_base"),
    pattern: getItemValue(item, "pattern", null),
    finish: getItemValue(item, "finish", null),
    isNeutral: getItemValue(item, "is_neutral", null),
    composition: getItemValue(item, "composition", null),
    silhouette: getItemValue(item, "silhouette", null),
    fit: getItemValue(item, "fit", null),
    closureType: getItemArray(item, "closure_type"),
    source: getItemValue(item, "source", null),
    processingStatus: getItemValue(item, "processing_status", null),
    wardrobeId: getItemValue(item, "wardrobe_id", null),
  };
}

export function appendUniqueWardrobeItems(items, extraItems) {
  const result = [];
  const seenKeys = new Set();

  for (const item of [...items, ...extraItems]) {
    const key = String(
      item?.url || item?.id || `${item?.category}:${item?.name}`,
    );
    if (!key || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    result.push(item);
  }

  return result;
}
