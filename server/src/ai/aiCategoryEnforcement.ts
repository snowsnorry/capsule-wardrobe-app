export {
  formatProfileValues,
  getCategoryListText,
  getCategorySchema,
  getFirstNonMinimalisticStyle,
  getNormalizedItemStyles,
  getSelectedIdsFromCapsule,
  getShortCapsuleName,
  normalizeCapsuleConstraintValue,
  normalizePatternValue,
} from "./aiCategoryHelpers.js";
import {
  getFirstNonMinimalisticStyle,
  getNormalizedItemStyles,
  normalizeCapsuleConstraintValue,
  normalizePatternValue,
} from "./aiCategoryHelpers.js";

export function isStyleMatched(item, targetStyle) {
  return (
    Boolean(targetStyle) && getNormalizedItemStyles(item).includes(targetStyle)
  );
}

export function isStyleSafe(item, targetStyle) {
  if (!targetStyle) {
    return true;
  }

  const styles = getNormalizedItemStyles(item);
  const nonMinimalisticStyles = styles.filter(
    (style) => style !== "minimalistic",
  );
  if (nonMinimalisticStyles.length === 0) {
    return true;
  }

  return nonMinimalisticStyles.every((style) => style === targetStyle);
}

export function isColorMatched(item, targetColor) {
  return (
    Boolean(targetColor) &&
    Array.isArray(item?.color_base) &&
    item.color_base.includes(targetColor)
  );
}

export function isNeutralItem(item) {
  return item?.is_neutral === true;
}

export function isPatternMatched(item, targetPattern) {
  if (!targetPattern || targetPattern === "solid") {
    return false;
  }

  return normalizePatternValue(item?.pattern) === targetPattern;
}

export function hasSolidOrNullPattern(item) {
  const normalizedPattern = normalizePatternValue(item?.pattern);
  return normalizedPattern === null || normalizedPattern === "solid";
}

function buildItemsByCategory(items, state) {
  const seenIds = new Set();
  const itemsByCategory = new Map(
    state.categoryOrder.map((category) => [category, []]),
  );

  for (const item of items) {
    const itemId = String(item?.id);
    const category = item?.category;
    if (
      !itemId ||
      seenIds.has(itemId) ||
      !state.allowedCategories.has(category)
    ) {
      continue;
    }
    seenIds.add(itemId);
    const categoryItems = itemsByCategory.get(category);
    if (Array.isArray(categoryItems)) {
      categoryItems.push(item);
    }
  }

  return itemsByCategory;
}

function createCategoryEnforcementState(categories, capsuleParams) {
  const categoryOrder = Object.keys(categories);
  const effectiveStyle = normalizeCapsuleConstraintValue(capsuleParams?.style);
  return {
    allowedCategories: new Set(categoryOrder),
    categories,
    categoryIndexByName: new Map(
      categoryOrder.map((category, index) => [category, index]),
    ),
    categoryOrder,
    colorMatchCount: 0,
    colorMatchCountByCategory: new Map(
      categoryOrder.map((category) => [category, 0]),
    ),
    effectiveColor: normalizeCapsuleConstraintValue(capsuleParams?.color),
    effectivePattern: normalizePatternValue(capsuleParams?.pattern) || "solid",
    effectiveStyle,
    hasExplicitStyle: Boolean(effectiveStyle),
    patternMatchCount: 0,
    poolByCategory: new Map(),
    result: [],
    resultIds: new Set(),
    selectedCountByCategory: new Map(
      categoryOrder.map((category) => [category, 0]),
    ),
    styleMatchCount: 0,
    styleMatchCountByCategory: new Map(
      categoryOrder.map((category) => [category, 0]),
    ),
  };
}

function getStyleLimit(state) {
  return state.effectiveStyle ? 4 : Infinity;
}

function getColorLimit(state) {
  return state.effectiveColor ? 3 : Infinity;
}

function getPatternLimit(state) {
  return state.effectivePattern !== "solid" ? 1 : Infinity;
}

function addItemToCategoryResult(state, item) {
  const itemId = String(item.id);
  if (state.resultIds.has(itemId)) {
    return false;
  }

  if (!state.hasExplicitStyle && !state.effectiveStyle) {
    state.effectiveStyle = getFirstNonMinimalisticStyle(item);
  }

  state.result.push(item);
  state.resultIds.add(itemId);
  state.selectedCountByCategory.set(
    item.category,
    (state.selectedCountByCategory.get(item.category) || 0) + 1,
  );
  trackCategoryConstraintMatches(state, item);
  return true;
}

function trackCategoryConstraintMatches(state, item) {
  if (isStyleMatched(item, state.effectiveStyle)) {
    state.styleMatchCount += 1;
    state.styleMatchCountByCategory.set(
      item.category,
      (state.styleMatchCountByCategory.get(item.category) || 0) + 1,
    );
  }

  if (isColorMatched(item, state.effectiveColor)) {
    state.colorMatchCount += 1;
    state.colorMatchCountByCategory.set(
      item.category,
      (state.colorMatchCountByCategory.get(item.category) || 0) + 1,
    );
  }

  if (isPatternMatched(item, state.effectivePattern)) {
    state.patternMatchCount += 1;
  }
}

function seedSelectedItems(state, selectedByCategory) {
  for (const category of state.categoryOrder) {
    const requiredCount = state.categories[category];
    const current = selectedByCategory.get(category).slice(0, requiredCount);
    for (const item of current) {
      addItemToCategoryResult(state, item);
    }
  }
}

function canUseStyleSafeCandidate(state, candidate) {
  if (!isStyleSafe(candidate, state.effectiveStyle)) {
    return false;
  }

  return (
    !isStyleMatched(candidate, state.effectiveStyle) ||
    state.styleMatchCount < getStyleLimit(state)
  );
}

function canUseColorSafeCandidate(state, candidate) {
  if (!state.effectiveColor) {
    return isNeutralItem(candidate);
  }

  return isColorMatched(candidate, state.effectiveColor)
    ? state.colorMatchCount < getColorLimit(state)
    : isNeutralItem(candidate);
}

function canUsePatternSafeCandidate(state, candidate) {
  if (state.effectivePattern === "solid") {
    return hasSolidOrNullPattern(candidate);
  }

  return isPatternMatched(candidate, state.effectivePattern)
    ? state.patternMatchCount < getPatternLimit(state)
    : hasSolidOrNullPattern(candidate);
}

function hasRemainingSlots(state, category) {
  return (
    (state.selectedCountByCategory.get(category) || 0) <
    (state.categories[category] || 0)
  );
}

function getAccentMatchContext(state, matchType) {
  return matchType === "style"
    ? {
        matchCountByCategory: state.styleMatchCountByCategory,
        effectiveMatchTarget: state.effectiveStyle,
        matchesAccent: (item) => isStyleMatched(item, state.effectiveStyle),
      }
    : {
        matchCountByCategory: state.colorMatchCountByCategory,
        effectiveMatchTarget: state.effectiveColor,
        matchesAccent: (item) => isColorMatched(item, state.effectiveColor),
      };
}

function canFutureCategoryUseAccent(
  state,
  category,
  index,
  categoryIndex,
  matchesAccent,
) {
  if (index <= categoryIndex || !hasRemainingSlots(state, category)) {
    return false;
  }

  const candidates = state.poolByCategory.get(category) || [];
  return candidates.some(
    (candidate) =>
      !state.resultIds.has(String(candidate?.id)) && matchesAccent(candidate),
  );
}

function hasFutureCategoryNeedingAccent(
  state,
  matchType,
  categoryIndex,
  currentCategory,
) {
  const { matchCountByCategory, effectiveMatchTarget, matchesAccent } =
    getAccentMatchContext(state, matchType);
  if (!effectiveMatchTarget) {
    return false;
  }

  for (const [category, index] of state.categoryIndexByName.entries()) {
    const alreadyHasAccent = (matchCountByCategory.get(category) || 0) > 0;
    if (category === currentCategory || alreadyHasAccent) {
      continue;
    }

    if (
      canFutureCategoryUseAccent(
        state,
        category,
        index,
        categoryIndex,
        matchesAccent,
      )
    ) {
      return true;
    }
  }

  return false;
}

function canUseDistributedCandidate(state, candidate, category, matchType) {
  const isMatch =
    matchType === "style"
      ? isStyleMatched(candidate, state.effectiveStyle)
      : isColorMatched(candidate, state.effectiveColor);
  if (!isMatch) {
    return true;
  }

  const countByCategory =
    matchType === "style"
      ? state.styleMatchCountByCategory
      : state.colorMatchCountByCategory;
  if ((countByCategory.get(category) || 0) === 0) {
    return true;
  }

  const categoryIndex = state.categoryIndexByName.get(category) ?? -1;
  return !hasFutureCategoryNeedingAccent(
    state,
    matchType,
    categoryIndex,
    category,
  );
}

function getCandidateGroups(state, category) {
  return [
    (candidate) =>
      canUseStyleSafeCandidate(state, candidate) &&
      canUseColorSafeCandidate(state, candidate) &&
      canUsePatternSafeCandidate(state, candidate) &&
      canUseDistributedCandidate(state, candidate, category, "style") &&
      canUseDistributedCandidate(state, candidate, category, "color"),
    (candidate) =>
      canUseStyleSafeCandidate(state, candidate) &&
      canUseColorSafeCandidate(state, candidate) &&
      canUsePatternSafeCandidate(state, candidate),
    (candidate) =>
      !isStyleMatched(candidate, state.effectiveStyle) &&
      canUseColorSafeCandidate(state, candidate) &&
      canUsePatternSafeCandidate(state, candidate),
    (candidate) =>
      canUseColorSafeCandidate(state, candidate) &&
      canUsePatternSafeCandidate(state, candidate),
    () => true,
  ];
}

function fillMissingCategoryItems(state, category) {
  const missing =
    state.categories[category] -
    (state.selectedCountByCategory.get(category) || 0);
  if (missing <= 0) {
    return;
  }

  const candidates = state.poolByCategory.get(category);
  let added = 0;
  for (const matchesGroup of getCandidateGroups(state, category)) {
    added += addMatchingCandidates(
      state,
      candidates,
      matchesGroup,
      missing - added,
    );
    if (added >= missing) {
      break;
    }
  }
}

function addMatchingCandidates(state, candidates, matchesGroup, limit) {
  let added = 0;
  for (const candidate of candidates) {
    const itemId = String(candidate?.id);
    if (!itemId || state.resultIds.has(itemId) || !matchesGroup(candidate)) {
      continue;
    }

    if (addItemToCategoryResult(state, candidate)) {
      added += 1;
    }

    if (added >= limit) {
      break;
    }
  }
  return added;
}

export function enforceCategoryCounts(
  selectedItems,
  normalizedItems,
  categories,
  capsuleParams = null,
) {
  const state = createCategoryEnforcementState(categories, capsuleParams);
  state.poolByCategory = buildItemsByCategory(normalizedItems, state);
  const selectedByCategory = buildItemsByCategory(selectedItems, state);
  seedSelectedItems(state, selectedByCategory);

  for (const category of state.categoryOrder) {
    fillMissingCategoryItems(state, category);
  }

  return state.result;
}
