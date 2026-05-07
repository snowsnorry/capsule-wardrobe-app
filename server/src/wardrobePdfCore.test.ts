import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  createWardrobePdfGenerationKey,
  formatLogPayload,
  formatLogValue,
  getPdfLocale,
  getStoredWardrobeItems,
  hasNonLatinText,
  loadImageBytes,
  logPdfEvent,
  normalizeImageBytes,
  normalizeStoredPdf,
  preparePdfImageBytes,
  productNeedsUnicodeFallback,
  resolveFontPath,
  resolveWardrobePdfChildExecArgv
} from "./wardrobePdfCore.js";

async function createPngBuffer() {
  return sharp({
    create: {
      width: 12,
      height: 8,
      channels: 4,
      background: "#ff000080"
    }
  }).png().toBuffer();
}

test("wardrobe pdf core helpers normalize logging, locale, stored data, and generation keys", () => {
  assert.equal(formatLogValue(null), "null");
  assert.equal(formatLogValue(undefined), "undefined");
  assert.equal(formatLogValue("value"), "value");
  assert.equal(formatLogValue(42), "42");
  assert.equal(formatLogValue(true), "true");
  assert.equal(formatLogValue({ ok: true }), "{\"ok\":true}");
  assert.equal(formatLogPayload({ a: 1, skipped: undefined, b: null }), "a: 1, b: null");

  const messages = [];
  const originalInfo = console.log;
  console.log = (message) => messages.push(message);
  try {
    logPdfEvent("empty");
    logPdfEvent("payload", { count: 2 });
  } finally {
    console.log = originalInfo;
  }

  assert.equal(getPdfLocale("ru-RU"), "ru");
  assert.equal(getPdfLocale("unsupported"), "en");
  assert.deepEqual(getStoredWardrobeItems(null), []);
  assert.deepEqual(getStoredWardrobeItems({ items: [{ id: "1" }] }), [{ id: "1" }]);
  assert.deepEqual(getStoredWardrobeItems({ items: { items: [{ id: "2" }] } }), [{ id: "2" }]);
  assert.deepEqual(normalizeStoredPdf(null), null);
  assert.deepEqual(normalizeStoredPdf(Buffer.from("pdf")), Buffer.from("pdf"));
  assert.deepEqual(normalizeStoredPdf(new Uint8Array([1, 2])), Buffer.from([1, 2]));
  assert.deepEqual(normalizeStoredPdf([3, 4]), Buffer.from([3, 4]));
  assert.deepEqual(normalizeStoredPdf("pdf"), null);
  assert.equal(hasNonLatinText("plain"), false);
  assert.equal(hasNonLatinText("платье"), true);
  assert.equal(productNeedsUnicodeFallback({ name: "Dress" }, "ru"), true);
  assert.equal(productNeedsUnicodeFallback({ name: "Платье" }, "en"), true);
  assert.equal(productNeedsUnicodeFallback({ name: "Dress" }, "en"), false);
  assert.equal(resolveWardrobePdfChildExecArgv(new URL("file:///tmp/wardrobePdf.child.js")).length, 0);
  assert.throws(() => resolveFontPath(["/definitely/missing/font.ttf"]), /font_not_found/);

  const key = createWardrobePdfGenerationKey({
    locale: "en",
    items: [
      { id: "fallback-id", category: "bag", name: "Bag" },
      { url: "https://example.com/top", category: "top", name: "Top" },
      { category: "bottom", name: "Jeans" }
    ]
  });
  assert.match(key, /https:\/\/example\.com\/top/);
  assert.match(key, /fallback-id/);
  assert.match(key, /bottom:Jeans/);
});

test("image byte helpers normalize nulls, mime types, resizing, and asset fallbacks", async () => {
  const pngBuffer = await createPngBuffer();
  const jpgBuffer = await sharp(pngBuffer).jpeg().toBuffer();

  assert.equal(await normalizeImageBytes(null, "image/png"), null);
  assert.deepEqual(await normalizeImageBytes(jpgBuffer, "image/jpeg"), { kind: "jpg", bytes: jpgBuffer });
  assert.deepEqual(await normalizeImageBytes(new Uint8Array(pngBuffer), "image/png"), {
    kind: "png",
    bytes: Buffer.from(pngBuffer)
  });
  assert.equal((await normalizeImageBytes(pngBuffer, "application/octet-stream"))?.kind, "png");

  assert.equal(await preparePdfImageBytes(null, "image/png", { width: 1, height: 1 }), null);
  assert.equal((await preparePdfImageBytes(pngBuffer, "image/png", {
    width: 6.4,
    height: 6.4,
    autoRotate: false
  }))?.kind, "png");
  assert.equal((await preparePdfImageBytes(jpgBuffer, "image/jpeg", {
    width: 6,
    height: 6
  }))?.kind, "jpg");

  assert.equal(await loadImageBytes(null, null), null);
  assert.deepEqual(await loadImageBytes(null, {
    buffer: jpgBuffer,
    mimeType: "image/jpeg",
    kind: "jpg",
    preparedForPdf: true
  }), { kind: "jpg", bytes: jpgBuffer });
  assert.equal((await loadImageBytes(null, {
    buffer: pngBuffer,
    mimeType: "image/png",
    kind: "png"
  }, { width: 5, height: 5 }))?.kind, "png");
});

test("loadImageBytes downloads external images and tracks failures without throwing", async (t) => {
  const pngBuffer = await createPngBuffer();
  const originalFetch = globalThis.fetch;
  const stats = { cachedCount: 0, downloadedCount: 0 };

  globalThis.fetch = async () => ({
    ok: true,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () => pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength)
  } as Response);
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const downloaded = await loadImageBytes("https://example.com/image.png", null, null, stats);
  assert.equal(downloaded?.kind, "png");
  assert.deepEqual(stats, { cachedCount: 0, downloadedCount: 1 });

  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0)
  } as Response);
  assert.equal(await loadImageBytes("https://example.com/fail.png", null, null, stats), null);
  assert.deepEqual(stats, { cachedCount: 0, downloadedCount: 2 });
});
