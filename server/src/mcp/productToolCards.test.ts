import { expect, test } from "vitest";

import {
  buildProductDetailMeta,
  buildProductGridMeta,
  formatProductFetchText,
  formatProductSearchText,
  type ProductToolCardItem,
} from "./productToolCards.js";

function product(overrides: Partial<ProductToolCardItem> = {}) {
  return {
    id: "product-1",
    name: "Blue [Coat]\n",
    brand: null,
    url: "",
    price: { display: null },
    availability: null,
    image: null,
    category: "outerwear",
    attributes: {
      isSavedToWardrobe: null,
      season: null,
      style: null,
    },
    ...overrides,
  };
}

test("formats empty product search results", () => {
  expect(formatProductSearchText([])).toBe("Found 0 products.");
});

test("formats product markdown fallback without optional image or url", () => {
  const item = product();

  expect(formatProductSearchText([item])).toBe(
    ["Found 1 products:", "1. Blue [Coat]"].join("\n"),
  );
  expect(formatProductFetchText(item)).toBe(
    ["Fetched product:", "Blue [Coat]"].join("\n"),
  );
});

test("falls back to product category when summary fields are blank", () => {
  const item = product({ name: "", id: "product-2" });

  expect(formatProductSearchText([item])).toBe(
    ["Found 1 products:", "1. product-2"].join("\n"),
  );
  expect(formatProductFetchText(item)).toBe(
    ["Fetched product:", "product-2"].join("\n"),
  );
  expect(buildProductGridMeta([item]).cards[0]).toMatchObject({
    subtitle: "outerwear",
  });
});

test("builds product cards with sanitized markdown image alt text", () => {
  const item = product({
    brand: "Acme",
    url: "https://example.test/products/coat",
    price: { display: "125 USD" },
    image: "https://example.test/coat.webp",
    attributes: {
      isSavedToWardrobe: true,
      season: ["winter"],
      style: ["minimalistic"],
    },
  });

  expect(formatProductFetchText(item)).toContain(
    "![Blue  Coat](https://example.test/coat.webp)",
  );
  expect(buildProductGridMeta([item])).toMatchObject({
    ui: { itemOrder: ["product-1"] },
    cards: [
      {
        itemId: "product-1",
        subtitle: "Acme · 125 USD",
        badges: ["outerwear", "winter"],
        primaryAction: {
          url: "https://example.test/products/coat",
        },
      },
    ],
    itemsById: {
      "product-1": item,
    },
  });
  expect(buildProductDetailMeta(item).cards).toHaveLength(1);
});

test("omits product card primary actions for unsafe URLs", () => {
  const item = product({
    url: "javascript:alert(1)",
    image: "data:text/html,<script>alert(1)</script>",
  });

  const gridMeta = buildProductGridMeta([item]);
  const detailMeta = buildProductDetailMeta(item);

  expect(gridMeta.cards[0]).toMatchObject({ image: null });
  expect(gridMeta.cards[0]).not.toHaveProperty("primaryAction");
  expect(gridMeta.itemsById["product-1"]).toMatchObject({
    url: "",
    image: null,
  });
  expect(detailMeta.cards[0]).toMatchObject({ image: null });
  expect(detailMeta.cards[0]).not.toHaveProperty("primaryAction");
  expect(formatProductSearchText([item])).toBe(
    ["Found 1 products:", "1. Blue [Coat]"].join("\n"),
  );
  expect(formatProductFetchText(item)).toBe(
    ["Fetched product:", "Blue [Coat]"].join("\n"),
  );
});
