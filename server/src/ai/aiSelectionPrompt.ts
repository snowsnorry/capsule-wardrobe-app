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
    url: getItemValue(item, "url"),
    name: getItemValue(item, "name"),
    category: getItemValue(item, "category"),
    image_url: getItemValue(item, "image_url"),
    audience: getItemValue(item, "audience"),
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
