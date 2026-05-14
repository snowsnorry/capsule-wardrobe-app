import { test, expect } from "vitest";
import { t, translateOption } from "./i18n/helpers.js";
import { buildProductDetailGroups } from "./productDetail.js";

test("product detail formatter uses locale-specific labels", () => {
  const item = {
    price: 190,
    currency: "USD",
    audience: "woman",
    season: ["spring"],
    colorBase: ["blue"],
    isNeutral: false,
  };

  const enGroups = buildProductDetailGroups(item, {
    t: (key, params) => t(key, params, "en"),
    translateOption,
    locale: "en",
  });
  const ruGroups = buildProductDetailGroups(item, {
    t: (key, params) => t(key, params, "ru"),
    translateOption,
    locale: "ru",
  });

  expect(enGroups[0].items[0].label).toBe("Price");
  expect(ruGroups[0].items[0].label).toBe("Цена");
  expect(enGroups[1].items[0].label).toBe("Color");
  expect(ruGroups[1].items[0].label).toBe("Цвет");
});

test("product detail formatter includes translated optional construction fields", () => {
  const groups = buildProductDetailGroups(
    {
      price: 49,
      availability: "in_stock",
      audience: "all",
      season: ["summer"],
      formalityLevel: ["smart_casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      colorBase: ["grey"],
      pattern: "solid",
      finish: "matte",
      isNeutral: true,
      composition: "linen, silk",
      silhouette: "a_line",
      fit: "regular",
      closureType: ["zipper"],
    },
    {
      t: (key, params) => t(key, params, "en"),
      translateOption,
      locale: "en",
    },
  );

  expect(groups).toHaveLength(3);
  expect(groups[0].items.map((item) => item.key)).toEqual([
    "price",
    "availability",
    "audience",
    "season",
  ]);
  expect(groups[1].items.map((item) => item.key)).toContain("neutral");
  expect(groups[2].items.map((item) => item.key)).toEqual([
    "composition",
    "finish",
    "silhouette",
    "fit",
    "closureType",
  ]);
});
