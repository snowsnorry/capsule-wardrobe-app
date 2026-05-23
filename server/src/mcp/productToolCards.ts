export type ProductToolCardItem = {
  id: string;
  name: string;
  brand: string | null;
  url: string;
  price: {
    display: string | null;
  };
  availability: string | null;
  image: string | null;
  category: string | null;
  attributes: {
    isSavedToWardrobe: boolean | null;
    season: string[] | null;
    style: string[] | null;
  };
};

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function markdownImageAlt(value: string): string {
  return value.replace(/[[\]\n\r]/g, " ").trim() || "Product";
}

function firstString(value: string[] | null): string | null {
  return value?.[0] || null;
}

function buildProductCard(item: ProductToolCardItem) {
  return {
    type: "product_card",
    itemId: item.id,
    title: item.name,
    subtitle:
      compactStrings([item.brand, item.price.display]).join(" · ") ||
      item.category ||
      "",
    image: item.image,
    badges: compactStrings([
      item.attributes.isSavedToWardrobe ? "Saved" : null,
      item.category,
      item.availability,
      firstString(item.attributes.season),
      firstString(item.attributes.style),
    ]),
    primaryAction: {
      type: "open_external",
      label: "Open product",
      url: item.url,
    },
  };
}

function buildProductItemsById(items: ProductToolCardItem[]) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function buildProductGridMeta(items: ProductToolCardItem[]) {
  return {
    ui: {
      component: "product_grid",
      version: "1.0",
      layout: "responsive_grid",
      itemOrder: items.map((item) => item.id),
    },
    cards: items.map(buildProductCard),
    itemsById: buildProductItemsById(items),
  };
}

export function buildProductDetailMeta(item: ProductToolCardItem) {
  return {
    ui: {
      component: "product_detail",
      version: "1.0",
    },
    cards: [buildProductCard(item)],
    itemsById: buildProductItemsById([item]),
  };
}

export function formatProductSearchText(items: ProductToolCardItem[]) {
  if (items.length === 0) {
    return "Found 0 products.";
  }

  const lines = [`Found ${items.length} products:`];
  items.slice(0, 10).forEach((item, index) => {
    const summary =
      compactStrings([item.name, item.brand, item.price.display]).join(" - ") ||
      item.name ||
      item.id;
    lines.push(`${index + 1}. ${summary}`);
    if (item.image) {
      lines.push(`   ![${markdownImageAlt(item.name)}](${item.image})`);
    }
    if (item.url) {
      lines.push(`   ${item.url}`);
    }
  });

  return lines.join("\n");
}

export function formatProductFetchText(item: ProductToolCardItem) {
  const summary =
    compactStrings([item.name, item.brand, item.price.display]).join(" - ") ||
    item.name ||
    item.id;
  return [
    "Fetched product:",
    summary,
    item.image ? `![${markdownImageAlt(item.name)}](${item.image})` : null,
    item.url,
  ]
    .filter(Boolean)
    .join("\n");
}
