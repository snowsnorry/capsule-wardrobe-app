function extractFormulaIds(formula) {
  const text = typeof formula === "string" ? formula : "";
  const matches = text.matchAll(/\[([^[\]]+)\]/g);

  return [...matches].map(([, id]) => String(id || "").trim()).filter(Boolean);
}

function normalizeOutfitSetItemIds(itemIds = [], itemsById = new Map()) {
  const normalizedItemIds = [];
  const categories = new Set();
  const seenCategories = new Set();

  for (const itemId of itemIds) {
    const category = getNextOutfitCategory(itemId, itemsById, seenCategories);
    if (category === null) {
      continue;
    }

    normalizedItemIds.push(itemId);
    if (category) {
      categories.add(category);
    }
  }

  return hasCompleteOutfitCore(categories)
    ? { itemIds: normalizedItemIds }
    : null;
}

function getNextOutfitCategory(itemId, itemsById, seenCategories) {
  const item = itemsById.get(itemId);
  if (!item) {
    return null;
  }

  const category = String(item?.category || "").trim();
  const categoryKey = category || `__missing__:${itemId}`;
  if (seenCategories.has(categoryKey)) {
    return null;
  }

  seenCategories.add(categoryKey);
  return category;
}

function hasCompleteOutfitCore(categories) {
  return (
    categories.has("dress") ||
    (categories.has("top") && categories.has("bottom"))
  );
}

function buildOutfitSetsFromFormulas(formulas = [], items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const itemsById = new Map(
    normalizedItems
      .map((item) => [String(item?.id || "").trim(), item] as const)
      .filter(([id]) => Boolean(id)),
  );

  return (Array.isArray(formulas) ? formulas : [])
    .map((formula) => {
      const itemIds = extractFormulaIds(formula).filter((id) =>
        itemsById.has(id),
      );
      return normalizeOutfitSetItemIds(itemIds, itemsById);
    })
    .filter(Boolean);
}

function getOutfitFormulas(parsedSelection = null) {
  return Array.isArray(parsedSelection?.system_evaluation?.outfit_formulas)
    ? parsedSelection.system_evaluation.outfit_formulas
    : [];
}

export { buildOutfitSetsFromFormulas, getOutfitFormulas };
