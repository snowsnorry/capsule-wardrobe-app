function extractFormulaIds(formula) {
  const text = typeof formula === "string" ? formula : "";
  const matches = text.matchAll(/\[([^\[\]]+)\]/g);

  return [...matches]
    .map(([, id]) => String(id || "").trim())
    .filter(Boolean);
}

function buildOutfitSetsFromFormulas(formulas = [], items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const itemsById = new Map(
    normalizedItems
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => id)
  );

  return (Array.isArray(formulas) ? formulas : [])
    .map((formula) => {
      const itemIds = extractFormulaIds(formula).filter((id) => itemsById.has(id));
      return itemIds.length >= 3 ? { itemIds } : null;
    })
    .filter(Boolean);
}

function getOutfitFormulas(parsedSelection = null) {
  return Array.isArray(parsedSelection?.system_evaluation?.outfit_formulas)
    ? parsedSelection.system_evaluation.outfit_formulas
    : [];
}

export {
  buildOutfitSetsFromFormulas,
  extractFormulaIds,
  getOutfitFormulas
};
