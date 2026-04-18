function formatItemDescription(item) {
  const parts = [];

  const color = String(item?.color || "").trim();
  const pattern = String(item?.pattern || "").trim();
  const name = String(item?.name || "").trim();
  const material = String(item?.materials || item?.material || "").trim();

  if (color) parts.push(color);
  if (pattern) parts.push(pattern);
  if (name) parts.push(name);

  let description = parts.join(" ");
  if (material) {
    description += ` (materials: ${material})`;
  }

  return description || "Unspecified item";
}

function buildOutfitSetDescription(items = []) {
  // Group items by their item kind for easy access.
  const groupedItems = items.reduce((acc, item) => {
    const category = String(item?.type || item?.category || "").trim().toLowerCase();
    if (!category) {
      return acc;
    }
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const promptSections = [];
  const hasDress = Boolean(groupedItems.dress?.length);

  const coreLines = [];

  if (groupedItems.outerwear) {
    groupedItems.outerwear.forEach((item) => {
      coreLines.push(`* **${formatItemDescription(item)}:** Placed at the very top, fully open, laid flat to show all silhouette and details (e.g., collar, pockets, buttons).`);
    });
  }

  if (hasDress) {
    groupedItems.dress.forEach((item) => {
      coreLines.push(`* **${formatItemDescription(item)}:** Laid out centrally, completely flat, showing full length and fit.`);
    });
  }

  if (groupedItems.midlayer) {
    groupedItems.midlayer.forEach((item) => {
      coreLines.push(`* **${formatItemDescription(item)}:** LAID OUT COMPLETELY FLAT AND UNFOLDED, placed below the outerwear. Do not fold or layer this item; show its full, uncreased shape exactly as seen in the source image.`);
    });
  }

  if (!hasDress) {
    if (groupedItems.top) {
      groupedItems.top.forEach((item) => {
        coreLines.push(`* **${formatItemDescription(item)}:** LAID OUT COMPLETELY FLAT AND UNFOLDED, placed below the outerwear/midlayer. Do not fold or layer this item; show its full, uncreased shape exactly as seen in the source image.`);
      });
    }
    if (groupedItems.bottom) {
      groupedItems.bottom.forEach((item) => {
        coreLines.push(`* **${formatItemDescription(item)}:** Laid out straight and flat below the top.`);
      });
    }
  }

  if (coreLines.length > 0) {
    promptSections.push("[**Central Vertical Core (from top to bottom)**]:\n" + coreLines.join("\n"));
  }

  const sideLines = [];

  if (groupedItems.bag) {
    groupedItems.bag.forEach((item) => {
      sideLines.push(`* **${formatItemDescription(item)}:** Placed to the left or right of the central core, showing its full form.`);
    });
  }

  if (groupedItems.belt) {
    groupedItems.belt.forEach((item) => {
      sideLines.push(`* **${formatItemDescription(item)}:** A coiled or straight detailed belt, placed below the top and above the bottom, or to one side of the central core.`);
    });
  }

  const accessories = groupedItems.accessories || groupedItems.accessory;
  if (accessories) {
    accessories.forEach((item) => {
      sideLines.push(`* **${formatItemDescription(item)}:** Placed neatly on the side to balance the composition.`);
    });
  }

  if (sideLines.length > 0) {
    promptSections.push("[**Side Zones (Left and Right)**]:\n" + sideLines.join("\n"));
  }

  const lowerLines = [];

  if (groupedItems.shoes) {
    groupedItems.shoes.forEach((item) => {
      lowerLines.push(`* **${formatItemDescription(item)}:** A pair placed side-by-side and slightly angled as if walking, below the main apparel.`);
    });
  }

  if (lowerLines.length > 0) {
    promptSections.push("[**Lower Zone (at the very bottom)**]:\n" + lowerLines.join("\n"));
  }

  return promptSections.join("\n\n");
}

export {
  buildOutfitSetDescription
};
