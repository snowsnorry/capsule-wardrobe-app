import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

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

function buildProductCard(item: ProductToolCardItem) {
  const safeUrl = getSafeHttpUrl(item.url);
  const safeImage = getSafeHttpUrl(item.image) || null;
  const primaryAction = safeUrl
    ? {
        type: "open_external",
        label: "Open product",
        url: safeUrl,
      }
    : undefined;

  return {
    type: "product_card",
    itemId: item.id,
    title: item.name,
    subtitle:
      compactStrings([item.brand, item.price.display]).join(" · ") ||
      item.category ||
      "",
    image: safeImage,
    badges: compactStrings([item.category, ...(item.attributes.season || [])]),
    ...(primaryAction ? { primaryAction } : {}),
  };
}

function buildProductItemsById(items: ProductToolCardItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        ...item,
        url: getSafeHttpUrl(item.url),
        image: getSafeHttpUrl(item.image) || null,
      },
    ]),
  );
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
    const safeImage = getSafeHttpUrl(item.image);
    const safeUrl = getSafeHttpUrl(item.url);
    const summary =
      compactStrings([item.name, item.brand, item.price.display]).join(" - ") ||
      item.name ||
      item.id;
    lines.push(`${index + 1}. ${summary}`);
    if (safeImage) {
      lines.push(`   ![${markdownImageAlt(item.name)}](${safeImage})`);
    }
    if (safeUrl) {
      lines.push(`   ${safeUrl}`);
    }
  });

  return lines.join("\n");
}

export function formatProductFetchText(item: ProductToolCardItem) {
  const summary =
    compactStrings([item.name, item.brand, item.price.display]).join(" - ") ||
    item.name ||
    item.id;
  const safeImage = getSafeHttpUrl(item.image);
  const safeUrl = getSafeHttpUrl(item.url);
  return [
    "Fetched product:",
    summary,
    safeImage ? `![${markdownImageAlt(item.name)}](${safeImage})` : null,
    safeUrl,
  ]
    .filter(Boolean)
    .join("\n");
}
