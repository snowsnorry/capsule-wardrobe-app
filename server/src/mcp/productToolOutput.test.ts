import { expect, test } from "vitest";

import { toNormalizedProduct } from "./productToolOutput.js";

test("normalizes product rows with missing optional fields", () => {
  expect(toNormalizedProduct({ id: 123 })).toMatchObject({
    id: "123",
    name: "",
    brand: null,
    url: "",
    description: null,
    price: {
      amount: null,
      currency: null,
      display: null,
    },
    availability: null,
    image: null,
    audience: null,
    category: null,
    attributes: {
      season: null,
      formalityLevel: null,
      style: null,
      occasions: null,
      colorBase: null,
      pattern: null,
      finish: null,
      isNeutral: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: null,
      isSavedToWardrobe: null,
    },
  });
});

test("normalizes product rows and filters array values", () => {
  const normalized = toNormalizedProduct({
    id: "product-1",
    name: "Black blazer",
    brand: "Acme",
    url: "https://example.test/products/black-blazer",
    description: "Tailored blazer",
    price: 120,
    currency: "USD",
    availability: "in_stock",
    imageUrl: "https://example.test/black-blazer.jpg",
    audience: "woman",
    category: "outerwear",
    season: ["winter", 1, "autumn"],
    formalityLevel: ["formal", null],
    style: ["minimalistic"],
    occasions: ["office", false],
    colorBase: ["black"],
    pattern: "solid",
    finish: "matte",
    isNeutral: true,
    composition: "wool",
    silhouette: "tailored",
    fit: "regular",
    closureType: ["button"],
    isSavedToWardrobe: false,
  });

  expect(normalized).toMatchObject({
    id: "product-1",
    name: "Black blazer",
    price: {
      amount: 120,
      currency: "USD",
      display: "120 USD",
    },
    attributes: {
      season: ["winter", "autumn"],
      formalityLevel: ["formal"],
      occasions: ["office"],
      isNeutral: true,
      isSavedToWardrobe: false,
    },
  });
  expect(normalized.image).toMatch(
    /^https:\/\/assets\.capsule-wardrobe\.org\/thumbnails\/[a-f0-9]{64}_640\.webp$/,
  );
});

test("formats numeric price without currency", () => {
  expect(
    toNormalizedProduct({
      id: "product-2",
      price: "45",
      currency: null,
    }).price,
  ).toEqual({
    amount: "45",
    currency: null,
    display: "45",
  });
});
