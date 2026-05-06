import test from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(enGroups[0].items[0].label, "Price");
  assert.equal(ruGroups[0].items[0].label, "Цена");
  assert.equal(enGroups[1].items[0].label, "Color");
  assert.equal(ruGroups[1].items[0].label, "Цвет");
});
