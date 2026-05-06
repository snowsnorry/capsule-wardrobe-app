import { mkdirSync, writeFileSync } from "node:fs";
import { buildCapsuleSchema, buildCustomJsonObjectFormat, buildSystemPrompt } from "./llm.js";
import { getPromptTemplateContent, loadPromptTemplate, renderPromptTemplateContent } from "./promptTemplates.js";
import { mergeWardrobeItemsWithMetadata } from "../../../shared/wardrobeMerge.js";
import type {
  CountByKey,
  GeneratedOutfitSetLike,
  PromptDebugImageCategory,
  StoredWardrobePayloadLike,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeUiItemLike
} from "./types.js";

const REGENERATE_SELECTED_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_regenerate_selected.yaml", import.meta.url)
);
const REGENERATE_SELECTED_USER_PROMPT_TEMPLATE = getPromptTemplateContent(REGENERATE_SELECTED_PROMPT_TEMPLATE, "user");
const REGENERATE_SELECTED_SYSTEM_PROMPT_TEMPLATE = getPromptTemplateContent(REGENERATE_SELECTED_PROMPT_TEMPLATE, "system");
export const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);

export type SqlWardrobeRow = WardrobeUiItemLike & {
  embedding?: unknown;
};

export function getSqlRows<TRow>(result: TRow[] | { count: number }): TRow[] {
  return Array.isArray(result) ? result : [];
}

export function isValidSelectedItemUrls(itemUrls: unknown): itemUrls is string[] {
  return Array.isArray(itemUrls) && itemUrls.length > 0 && itemUrls.every((itemUrl) => (
    typeof itemUrl === "string" && itemUrl.trim().length > 0
  ));
}

export function buildStoredWardrobePayloadFromResult(
  result: Partial<WardrobeGenerationResult> = {},
  storedWardrobe: StoredWardrobePayloadLike | null = null
): StoredWardrobePayloadLike {
  return {
    items: Array.isArray(result?.items) ? result.items : [],
    outfitSets: normalizeGeneratedOutfitSets(result?.outfitSets),
    rawSelectionText: result?.rawSelectionText || null,
    swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
    swimwearRawSelectionText: storedWardrobe?.swimwearRawSelectionText || null
  };
}

function normalizeGeneratedOutfitSets(outfitSets) {
  return Array.isArray(outfitSets)
    ? outfitSets.map(normalizeGeneratedOutfitSet)
    : [];
}

function normalizeGeneratedOutfitSet(outfitSet) {
  const generatedOutfitSet = outfitSet as GeneratedOutfitSetLike | undefined;
  return {
    itemIds: Array.isArray(generatedOutfitSet?.itemIds)
      ? generatedOutfitSet.itemIds.map((itemId) => String(itemId))
      : [],
    image: typeof generatedOutfitSet?.image === "string" ? generatedOutfitSet.image ?? null : null,
    imageObsolete: Boolean(generatedOutfitSet?.imageObsolete)
  };
}

export function remapOutfitSetsAfterPartialRegeneration({
  currentItems = [],
  nextItems = [],
  pendingUrls = [],
  outfitSets = []
} = {}) {
  const { replacementMap } = mergeWardrobeItemsWithMetadata({
    currentItems,
    nextItems,
    pendingUrls
  });

  return (Array.isArray(outfitSets) ? outfitSets : [])
    .map((set) => {
      const currentItemIds = Array.isArray(set?.itemIds)
        ? set.itemIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      if (currentItemIds.length === 0) {
        return null;
      }

      let hasChanges = false;
      const nextItemIds = currentItemIds.map((itemId) => {
        const nextItemId = replacementMap.get(itemId) || itemId;
        if (nextItemId !== itemId) {
          hasChanges = true;
        }
        return nextItemId;
      });

      return {
        itemIds: nextItemIds,
        image: typeof set?.image === "string" && set.image.trim().length > 0
          ? set.image.trim()
          : null,
        imageObsolete: hasChanges && typeof set?.image === "string" && set.image.trim().length > 0
          ? true
          : Boolean(set?.imageObsolete)
      };
    })
    .filter((set) => Array.isArray(set?.itemIds) && set.itemIds.length > 0);
}

export function formatProfileValues(values: string[] | null | undefined) {
  if (!Array.isArray(values) || values.length === 0) {
    return "Not specified";
  }

  const formatted = values
    .filter((value) => typeof value === "string" && value.trim().length > 0);
  if (formatted.length === 0) {
    return "Not specified";
  }

  return formatted.join(", ");
}

export function getCategoryListText(categories: CountByKey) {
  return Object.entries(categories)
    .filter(([, count]) => Number.isInteger(count) && count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");
}

export function simplifyPromptItems(items: WardrobeUiItemLike[] = []) {
  return items.map(simplifyPromptItem);
}

function getPromptItemColors(item) {
  return [
    getPromptItemBaseColors(item),
    getTrimmedText(item?.pattern) || "",
    getTrimmedText(item?.finish) || "",
    item?.is_neutral || item?.isNeutral ? "neutral" : ""
  ].filter(Boolean);
}

function getPromptItemBaseColors(item) {
  if (Array.isArray(item?.color_base)) {
    return item.color_base.join(", ");
  }

  return Array.isArray(item?.colorBase) ? item.colorBase.join(", ") : "";
}

function getPromptItemFormalityLevels(item) {
  if (Array.isArray(item?.formality_level)) {
    return item.formality_level;
  }

  return Array.isArray(item?.formalityLevel) ? item.formalityLevel : [];
}

function getTrimmedText(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getPromptItemValue(item, key, fallback = "") {
  return item?.[key] ?? fallback;
}

function simplifyPromptItem(item) {
  return {
    id: getPromptItemValue(item, "id", null),
    name: getPromptItemValue(item, "name"),
    type: getPromptItemValue(item, "category"),
    color: getPromptItemColors(item).join(", "),
    formality_level: getPromptItemFormalityLevels(item),
    style: Array.isArray(item?.style) ? item.style : [],
    materials: getPromptItemValue(item, "composition"),
    fit: getTrimmedText(item?.fit) || "",
    silhouette: getTrimmedText(item?.silhouette) || ""
  };
}

export function buildRegeneratedItemsFormat(categories) {
  return buildCustomJsonObjectFormat(
    "capsule_regenerate_selected_response",
    "Structured partial capsule regeneration selection with brief reasoning and exact replacement counts.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        system_evaluation: {
          type: "object",
          additionalProperties: false,
          required: ["overall_explanation", "outfit_formulas"],
          properties: {
            overall_explanation: {
              type: "string"
            },
            outfit_formulas: {
              type: "array",
              items: {
                type: "string"
              },
              minItems: 3,
              maxItems: 4
            }
          }
        },
        item_details: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "role", "reason", "compatibility", "warning"],
            properties: {
              id: { type: "string" },
              role: {
                type: "string",
                enum: ["anchor", "connector", "accent"]
              },
              reason: { type: "string" },
              compatibility: { type: "string" },
              warning: { type: "string" }
            }
          }
        },
        regenerated_items: buildCapsuleSchema(categories)
      },
      required: ["system_evaluation", "item_details", "regenerated_items"]
    }
  );
}

export function buildRegenerateSelectedSystemPrompt(
  userProfile: UserProfileLike | null = null,
  categories: CountByKey | null = null
) {
  return buildSystemPrompt(userProfile, {
    categories,
    template: REGENERATE_SELECTED_SYSTEM_PROMPT_TEMPLATE
  });
}

export function buildLastPromptArtifact(prompt, userProfile = null, systemPrompt = "") {
  if (typeof prompt !== "string") {
    return "";
  }

  const resolvedSystemPrompt = typeof systemPrompt === "string" && systemPrompt.trim().length > 0
    ? systemPrompt
    : buildRegenerateSelectedSystemPrompt(userProfile);
  return [
    resolvedSystemPrompt ? `System:\n${resolvedSystemPrompt}` : "",
    `User:\n${prompt}`
  ].filter(Boolean).join("\n\n");
}

export function saveLastPromptArtifacts({
  prompt,
  currentCapsuleCollage,
  userProfile = null,
  systemPrompt = ""
}: {
  prompt?: string | null;
  currentCapsuleCollage?: PromptDebugImageCategory | null;
  userProfile?: UserProfileLike | null;
  systemPrompt?: string | null;
} = {}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });

  if (typeof prompt === "string") {
    writeFileSync(
      new URL("last_prompt.txt", LAST_PROMPT_DIR_URL),
      buildLastPromptArtifact(prompt, userProfile, systemPrompt),
      "utf8"
    );
  }

  if (currentCapsuleCollage?.buffer) {
    writeFileSync(
      new URL("current-capsule.jpg", LAST_PROMPT_DIR_URL),
      currentCapsuleCollage.buffer
    );
  }
}

export function buildRegenerateSelectedPrompt(
  userProfile: UserProfileLike | null = null,
  candidateItems: WardrobeUiItemLike[] = [],
  currentCapsuleItems: WardrobeUiItemLike[] = [],
  categories: CountByKey = {}
) {
  const replacements = buildRegenerateSelectedReplacements(userProfile, candidateItems, currentCapsuleItems, categories);

  return renderPromptTemplateContent(
    REGENERATE_SELECTED_USER_PROMPT_TEMPLATE,
    replacements,
    "regenerate prompt"
  );
}

function formatPromptText(value, fallback) {
  return getTrimmedText(value) || fallback;
}

function formatPromptPattern(value) {
  const pattern = getTrimmedText(value);
  if (!pattern) {
    return "solid (no print)";
  }

  return pattern.toLowerCase() === "solid" ? "solid (no print)" : pattern;
}

function buildRegenerateSelectedReplacements(
  userProfile: UserProfileLike | null,
  candidateItems: WardrobeUiItemLike[],
  currentCapsuleItems: WardrobeUiItemLike[],
  categories: CountByKey
) {
  const additionalText = getTrimmedText(userProfile?.text);

  return {
    audience: userProfile?.audience || "any",
    occasions: formatProfileValues(userProfile?.occasions),
    formality_level: formatPromptText(userProfile?.formalityLevel, "Not specified"),
    style: formatPromptText(userProfile?.style, "Not specified"),
    color: formatPromptText(userProfile?.color, "No accent color (keep the capsule fully neutral)"),
    pattern: formatPromptPattern(userProfile?.pattern),
    additional_info_block: additionalText ? `Important Additional Information: ${additionalText}` : "",
    current_capsule_items: JSON.stringify(simplifyPromptItems(currentCapsuleItems), null, 2),
    category_list: getCategoryListText(categories),
    items: JSON.stringify(simplifyPromptItems(candidateItems), null, 2),
    num_items: String(Object.values(categories).reduce((sum, count) => sum + Number(count), 0)),
    categories_schema: JSON.stringify(buildCapsuleSchema(categories), null, 2)
  };
}
