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
    isNeutral: false
  };

  const enGroups = buildProductDetailGroups(item, {
    t: (key, params) => t(key, params, "en"),
    translateOption,
    locale: "en"
  });
  const ruGroups = buildProductDetailGroups(item, {
    t: (key, params) => t(key, params, "ru"),
    translateOption,
    locale: "ru"
  });

  expect(enGroups[0].items[0].label).toBe("Price");
  expect(ruGroups[0].items[0].label).toBe("Цена");
  expect(enGroups[1].items[0].label).toBe("Color");
  expect(ruGroups[1].items[0].label).toBe("Цвет");
});
