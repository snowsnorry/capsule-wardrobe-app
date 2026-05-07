function formatItemDescription(item) {
  const description = ["color", "pattern", "name"]
    .map((key) => getTrimmedItemValue(item, key))
    .filter(Boolean)
    .join(" ");
  const material =
    getTrimmedItemValue(item, "materials") ||
    getTrimmedItemValue(item, "material");
  return material
    ? `${description} (materials: ${material})`.trim()
    : description || "Unspecified item";
}

function getTrimmedItemValue(item, key) {
  return String(item?.[key] || "").trim();
}

function getGroupedItems(items) {
  return items.reduce((acc, item) => {
    const category = String(item?.type || item?.category || "")
      .trim()
      .toLowerCase();
    return category
      ? { ...acc, [category]: [...(acc[category] || []), item] }
      : acc;
  }, {});
}

function pushItemLines(lines, items, instruction) {
  (items || []).forEach((item) => {
    lines.push(`* **${formatItemDescription(item)}:** ${instruction}`);
  });
}

function getCoreLines(groupedItems, hasDress) {
  const coreLines = [];
  pushItemLines(
    coreLines,
    groupedItems.outerwear,
    "Placed at the very top, fully open, laid flat to show all silhouette and details (e.g., collar, pockets, buttons).",
  );
  if (hasDress) {
    pushItemLines(
      coreLines,
      groupedItems.dress,
      "Laid out centrally, completely flat, showing full length and fit.",
    );
    return coreLines;
  }
  pushItemLines(
    coreLines,
    groupedItems.midlayer,
    "LAID OUT COMPLETELY FLAT AND UNFOLDED, placed below the outerwear. Do not fold or layer this item; show its full, uncreased shape exactly as seen in the source image.",
  );
  pushItemLines(
    coreLines,
    groupedItems.top,
    "LAID OUT COMPLETELY FLAT AND UNFOLDED, placed below the outerwear/midlayer. Do not fold or layer this item; show its full, uncreased shape exactly as seen in the source image.",
  );
  pushItemLines(
    coreLines,
    groupedItems.bottom,
    "Laid out straight and flat below the top.",
  );
  return coreLines;
}

function getSideLines(groupedItems) {
  const sideLines = [];
  pushItemLines(
    sideLines,
    groupedItems.bag,
    "Placed to the left or right of the central core, showing its full form.",
  );
  pushItemLines(
    sideLines,
    groupedItems.belt,
    "A coiled or straight detailed belt, placed below the top and above the bottom, or to one side of the central core.",
  );
  pushItemLines(
    sideLines,
    groupedItems.accessories || groupedItems.accessory,
    "Placed neatly on the side to balance the composition.",
  );
  return sideLines;
}

function buildPromptSection(title, lines) {
  return lines.length > 0 ? `${title}:\n${lines.join("\n")}` : "";
}

function buildOutfitSetDescription(items = []) {
  const groupedItems = getGroupedItems(items);
  const hasDress = Boolean(groupedItems.dress?.length);
  const lowerLines = [];
  pushItemLines(
    lowerLines,
    groupedItems.shoes,
    "A pair placed side-by-side and slightly angled as if walking, below the main apparel.",
  );

  return [
    buildPromptSection(
      "[**Central Vertical Core (from top to bottom)**]",
      getCoreLines(groupedItems, hasDress),
    ),
    buildPromptSection(
      "[**Side Zones (Left and Right)**]",
      getSideLines(groupedItems),
    ),
    buildPromptSection("[**Lower Zone (at the very bottom)**]", lowerLines),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export { buildOutfitSetDescription };
