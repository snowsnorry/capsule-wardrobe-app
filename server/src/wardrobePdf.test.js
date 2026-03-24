import test from "node:test";
import assert from "node:assert/strict";
import { createWardrobePdfDownloadHandler } from "./wardrobePdf.js";
import { buildProductDetailGroups } from "../../shared/productDetail.js";
import { t, translateOption } from "../../shared/i18n/helpers.js";

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("wardrobe pdf endpoint returns attachment headers and preserves capsule order", async () => {
  let receivedIds = null;
  let receivedLocale = null;
  const handler = createWardrobePdfDownloadHandler({
    getProfileByEmail: async () => ({
      items: {
        items: [
          { id: "bag-1", category: "bag", name: "B Bag" },
          { id: "top-2", category: "top", name: "Z Top" },
          { id: "top-1", category: "top", name: "A Top" }
        ]
      }
    }),
    getProducts: async (ids) => {
      receivedIds = ids;
      return ids.map((id) => ({
        id,
        name: id,
        category: id.startsWith("bag") ? "bag" : "top",
        imageUrl: ""
      }));
    },
    buildPdf: async (products, { locale }) => {
      receivedLocale = locale;
      return Buffer.from(`pdf:${products.map((product) => product.id).join(",")}`);
    }
  });

  const res = createResponseRecorder();
  await handler(
    {
      user: { email: "person@example.com" },
      body: { locale: "ru-RU" }
    },
    res
  );

  assert.deepEqual(receivedIds, ["top-1", "top-2", "bag-1"]);
  assert.equal(receivedLocale, "ru");
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.equal(res.headers["Content-Disposition"], 'attachment; filename="capsule-wardrobe.pdf"');
  assert.equal(String(res.body), "pdf:top-1,top-2,bag-1");
});

test("wardrobe pdf endpoint skips missing products and still returns a file", async () => {
  const handler = createWardrobePdfDownloadHandler({
    getProfileByEmail: async () => ({
      items: {
        items: [
          { id: "outerwear-1", category: "outerwear", name: "Coat" },
          { id: "bag-1", category: "bag", name: "Bag" }
        ]
      }
    }),
    getProducts: async () => ([
      { id: "outerwear-1", name: "Coat", category: "outerwear", imageUrl: "" }
    ]),
    buildPdf: async (products) => Buffer.from(products.map((product) => product.id).join(","))
  });

  const res = createResponseRecorder();
  await handler(
    {
      user: { email: "person@example.com" },
      body: { locale: "en" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body), "outerwear-1");
});

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
