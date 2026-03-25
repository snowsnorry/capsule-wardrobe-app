import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { buildWardrobePdf, createWardrobePdfJobManager } from "./wardrobePdf.js";
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

test("wardrobe pdf endpoint returns stored attachment when pdf already exists", async () => {
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      items: {
        items: [
          { id: "bag-1", category: "bag", name: "B Bag" },
          { id: "top-2", category: "top", name: "Z Top" },
          { id: "top-1", category: "top", name: "A Top" }
        ]
      },
      locale: "ru"
    }),
    getProfilePdfByEmail: async () => Buffer.from("stored-pdf")
  });

  const res = createResponseRecorder();
  await manager.downloadWardrobePdf(
    {
      user: { email: "person@example.com" },
      body: { locale: "ru-RU" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.equal(res.headers["Content-Disposition"], 'attachment; filename="capsule-wardrobe.pdf"');
  assert.equal(String(res.body), "stored-pdf");
});

test("wardrobe pdf endpoint returns pending and starts job when pdf is missing", async () => {
  let updatedPdf = null;
  let receivedIds = null;
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      items: {
        items: [
          { id: "bag-1", category: "bag", name: "Bag" },
          { id: "top-2", category: "top", name: "Z Top" },
          { id: "top-1", category: "top", name: "A Top" }
        ]
      },
      locale: "en"
    }),
    getProfilePdfByEmail: async () => null,
    updateProfilePdfByEmail: async (_email, pdf) => {
      updatedPdf = pdf;
      return { email: _email };
    },
    getProducts: async (ids) => {
      receivedIds = ids;
      return ids.map((id) => ({
        id,
        name: id,
        category: id.startsWith("bag") ? "bag" : "top",
        imageUrl: ""
      }));
    },
    buildPdf: async (products) => Buffer.from(`pdf:${products.map((product) => product.id).join(",")}`)
  });

  const res = createResponseRecorder();
  await manager.downloadWardrobePdf(
    {
      user: { email: "person@example.com" },
      body: {}
    },
    res
  );

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.status, "pending");
  assert.equal(res.body.pollAfterMs, 2000);

  const job = manager.getWardrobePdfJob("person@example.com");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(receivedIds, ["top-1", "top-2", "bag-1"]);
  assert.equal(String(updatedPdf), "pdf:top-1,top-2,bag-1");
});

test("ensureWardrobePdfJob reuses active pending job for same generation", async () => {
  let buildCount = 0;
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      items: {
        items: [{ id: "top-1", category: "top", name: "A Top" }]
      },
      locale: "en"
    }),
    getProducts: async (ids) => ids.map((id) => ({
      id,
      name: id,
      category: "top",
      imageUrl: ""
    })),
    updateProfilePdfByEmail: async () => ({ email: "person@example.com" }),
    buildPdf: async () => {
      buildCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Buffer.from("pdf");
    }
  });

  const first = await manager.ensureWardrobePdfJob("person@example.com", {
    wardrobePayload: {
      items: [{ id: "top-1", category: "top", name: "A Top" }]
    },
    locale: "en"
  });
  const second = await manager.ensureWardrobePdfJob("person@example.com", {
    wardrobePayload: {
      items: [{ id: "top-1", category: "top", name: "A Top" }]
    },
    locale: "en"
  });

  assert.equal(first, second);
  await first.promise;
  assert.equal(buildCount, 1);
});

test("buildWardrobePdf consumes prepared image assets as pages are rendered", async () => {
  const imageBuffer = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: "#aa6644"
    }
  }).jpeg({ quality: 80 }).toBuffer();
  const imageAssetsById = {
    "top-1": {
      buffer: imageBuffer,
      mimeType: "image/jpeg",
      kind: "jpg",
      preparedForPdf: true,
      imageUrl: "https://example.com/top-1.jpg"
    }
  };

  const pdfBuffer = await buildWardrobePdf([{
    id: "top-1",
    name: "Top",
    category: "top",
    imageUrl: "https://example.com/top-1.jpg",
    brand: "Brand",
    description: "Description"
  }], {
    locale: "ru",
    imageAssetsById
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.equal(Object.keys(imageAssetsById).length, 0);
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
