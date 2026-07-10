import { test, expect, vi } from "vitest";
import sharp from "sharp";
import { muteExpectedStructuredLog } from "./test/structuredLogSpies.js";
import {
  createWardrobePdfGenerationKey,
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
  resolveWardrobePdfChildExecArgv,
  setPdfImageDownloadBufferImplForTests,
} from "./wardrobePdfCore.js";

async function createPngBuffer() {
  return sharp({
    create: {
      width: 12,
      height: 8,
      channels: 4,
      background: "#ff000080",
    },
  })
    .png()
    .toBuffer();
}

test("wardrobe pdf core helpers normalize logging, locale, stored data, and generation keys", () => {
  const writes: string[] = [];
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
  logPdfEvent("empty");
  logPdfEvent("payload", { count: 2 });
  stdout.mockRestore();
  expect(writes).toEqual([
    expect.stringContaining("event=pdf.empty"),
    expect.stringContaining("event=pdf.payload count=2"),
  ]);

  expect(getPdfLocale("ru-RU")).toBe("ru");
  expect(getPdfLocale("unsupported")).toBe("en");
  expect(getStoredWardrobeItems(null)).toEqual([]);
  expect(getStoredWardrobeItems({ items: [{ id: "1" }] })).toEqual([
    { id: "1" },
  ]);
  expect(getStoredWardrobeItems({ items: { items: [{ id: "2" }] } })).toEqual([
    { id: "2" },
  ]);
  expect(normalizeStoredPdf(null)).toEqual(null);
  expect(normalizeStoredPdf(Buffer.from("pdf"))).toEqual(Buffer.from("pdf"));
  expect(normalizeStoredPdf(new Uint8Array([1, 2]))).toEqual(
    Buffer.from([1, 2]),
  );
  expect(normalizeStoredPdf([3, 4])).toEqual(Buffer.from([3, 4]));
  expect(normalizeStoredPdf("pdf")).toEqual(null);
  expect(hasNonLatinText("plain")).toBe(false);
  expect(hasNonLatinText("платье")).toBe(true);
  expect(productNeedsUnicodeFallback({ name: "Dress" }, "ru")).toBe(true);
  expect(productNeedsUnicodeFallback({ name: "Платье" }, "en")).toBe(true);
  expect(productNeedsUnicodeFallback({ name: "Dress" }, "en")).toBe(false);
  expect(
    resolveWardrobePdfChildExecArgv(new URL("file:///tmp/wardrobePdf.child.js"))
      .length,
  ).toBe(0);
  expect(() => resolveFontPath(["/definitely/missing/font.ttf"])).toThrow(
    /font_not_found/,
  );

  const key = createWardrobePdfGenerationKey({
    locale: "en",
    items: [
      { id: "fallback-id", category: "bag", name: "Bag" },
      { url: "https://example.com/top", category: "top", name: "Top" },
      { category: "bottom", name: "Jeans" },
    ],
  });
  expect(key).toMatch(/https:\/\/example\.com\/top/);
  expect(key).toMatch(/fallback-id/);
  expect(key).toMatch(/bottom:Jeans/);
});

test("image byte helpers normalize nulls, mime types, resizing, and asset fallbacks", async (_t) => {
  const pngBuffer = await createPngBuffer();
  const jpgBuffer = await sharp(pngBuffer).jpeg().toBuffer();

  expect(await normalizeImageBytes(null, "image/png")).toBe(null);
  expect(await normalizeImageBytes(jpgBuffer, "image/jpeg")).toEqual({
    kind: "jpg",
    bytes: jpgBuffer,
  });
  expect(
    await normalizeImageBytes(new Uint8Array(pngBuffer), "image/png"),
  ).toEqual({
    kind: "png",
    bytes: Buffer.from(pngBuffer),
  });
  expect(
    (await normalizeImageBytes(pngBuffer, "application/octet-stream"))?.kind,
  ).toBe("png");

  expect(
    await preparePdfImageBytes(null, "image/png", { width: 1, height: 1 }),
  ).toBe(null);
  expect(
    (
      await preparePdfImageBytes(pngBuffer, "image/png", {
        width: 6.4,
        height: 6.4,
        autoRotate: false,
      })
    )?.kind,
  ).toBe("png");
  expect(
    (
      await preparePdfImageBytes(jpgBuffer, "image/jpeg", {
        width: 6,
        height: 6,
      })
    )?.kind,
  ).toBe("jpg");

  expect(await loadImageBytes(null, null)).toBe(null);
  expect(
    await loadImageBytes(null, {
      buffer: jpgBuffer,
      mimeType: "image/jpeg",
      kind: "jpg",
      preparedForPdf: true,
    }),
  ).toEqual({ kind: "jpg", bytes: jpgBuffer });
  expect(
    (
      await loadImageBytes(
        null,
        {
          buffer: pngBuffer,
          mimeType: "image/png",
          kind: "png",
        },
        { width: 5, height: 5 },
      )
    )?.kind,
  ).toBe("png");
});

test("loadImageBytes downloads external images and tracks failures without throwing", async (t) => {
  const pngBuffer = await createPngBuffer();
  const stats = { cachedCount: 0, downloadedCount: 0 };

  setPdfImageDownloadBufferImplForTests(async ({ url }) => ({
    buffer: pngBuffer,
    headers: new Headers({ "content-type": "image/png" }),
    status: 200,
    url,
  }));
  t.onTestFinished(() => {
    setPdfImageDownloadBufferImplForTests(null);
  });

  const downloaded = await loadImageBytes(
    "https://example.com/image.png",
    null,
    null,
    stats,
  );
  expect(downloaded?.kind).toBe("png");
  expect(stats).toEqual({ cachedCount: 0, downloadedCount: 1 });

  setPdfImageDownloadBufferImplForTests(async ({ url }) => ({
    buffer: Buffer.alloc(0),
    headers: new Headers(),
    status: 500,
    url,
  }));
  muteExpectedStructuredLog(t, "error", "pdf.image.download.failed");
  expect(
    await loadImageBytes("https://example.com/fail.png", null, null, stats),
  ).toBe(null);
  expect(stats).toEqual({ cachedCount: 0, downloadedCount: 2 });
});

test("loadImageBytes treats over-limit downloads as unavailable images", async (t) => {
  const stats = { cachedCount: 0, downloadedCount: 0 };
  setPdfImageDownloadBufferImplForTests(async () => {
    throw new Error("image_download_too_large");
  });
  t.onTestFinished(() => {
    setPdfImageDownloadBufferImplForTests(null);
  });

  muteExpectedStructuredLog(t, "error", "pdf.image.download.failed");

  await expect(
    loadImageBytes("https://example.com/large.png", null, null, stats),
  ).resolves.toBe(null);
  expect(stats).toEqual({ cachedCount: 0, downloadedCount: 1 });
});
