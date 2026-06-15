import { test, expect } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { buildLocalImageCachePath } from "./ai/promptImages.js";
import { buildWardrobePdf } from "./wardrobePdfRender.js";
import {
  formatReportValue,
  getReportChipValues,
  getReportScoreRows,
  getReportTemperatureLabel,
  getReportVerdictLabel,
  outfitNeedsUnicodeFallback,
  toPercent,
} from "./wardrobePdfOutfit.js";
import { getScoreTone } from "./wardrobePdfOutfitReport.js";

async function withCachedImage(testContext, imageUrl, buffer) {
  const cachePath = buildLocalImageCachePath(imageUrl);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buffer);
  testContext.onTestFinished(async () => {
    await rm(cachePath, { force: true });
  });
}

async function getPdfPageCount(buffer) {
  return (await PDFDocument.load(buffer)).getPageCount();
}

function buildReport(overrides = {}) {
  return {
    verdict: {
      status: "valid",
      score: 0.9,
      summary: "This outfit is ready to wear.",
    },
    seasonality: {
      primarySeasons: ["spring"],
      temperatureBandC: { min: 10, max: 18 },
      seasonScore: 0.8,
    },
    styleProfile: {
      formalityLevel: "casual",
      primaryStyle: "minimalistic",
      styleScore: 0.85,
    },
    compatibility: {
      overallScore: 0.9,
      styleCoherence: 0.86,
      formalityCoherence: 0.88,
      seasonalCoherence: 0.8,
      colorCoherence: 0.92,
      mainStrengths: ["Balanced proportions."],
      mainRisks: ["Needs a warmer layer below 10C."],
    },
    colorAnalysis: {
      paletteType: "neutral",
      colorScore: 0.92,
    },
    issues: [
      {
        message: "Low warmth for evening wear.",
        suggestion: "Add a midlayer.",
        affectedItemIds: ["item-1"],
      },
    ],
    suggestions: [
      {
        priority: "high",
        message: "Keep the shoes and bag together.",
        targetItemIds: ["item-2"],
      },
    ],
    confidence: {
      overall: 0.8,
      assumptions: ["Based on available item metadata."],
    },
    ...overrides,
  };
}

test("buildWardrobePdf consumes prepared image assets as pages are rendered", async (_t) => {
  const imageBuffer = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: "#aa6644",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  const imageAssetsById = {
    "top-1": {
      buffer: imageBuffer,
      mimeType: "image/jpeg",
      kind: "jpg",
      preparedForPdf: true,
      imageUrl: "https://example.com/top-1.jpg",
    },
  };

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl: "https://example.com/top-1.jpg",
        brand: "Brand",
        description: "Description",
      },
    ],
    {
      locale: "ru",
      imageAssetsById,
    },
  );

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(Object.keys(imageAssetsById).length).toBe(0);
});

test("buildWardrobePdf uses local cached image before remote fetch", async (t) => {
  const imageUrl =
    "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  const cachedJpeg = await sharp({
    create: {
      width: 1000,
      height: 700,
      channels: 3,
      background: "#0f766e",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, cachedJpeg);
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl,
        brand: "Brand",
        description: "Description",
      },
    ],
    {
      locale: "en",
    },
  );

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(pdfBuffer.length > 0).toBeTruthy();
});

test("buildWardrobePdf renders fallback title and image placeholder without remote image", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };
  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "",
        name: "",
        category: "",
        imageUrl: "",
        brand: "",
        description: "",
        url: "not-a-url",
      },
    ],
    {
      locale: "en",
      totalStartedAt: Date.now(),
    },
  );

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(pdfBuffer.length > 0).toBeTruthy();
});

test("buildWardrobePdf prepends outfit image cover and appends stale report pages", async (t) => {
  const imageUrl = "https://images.example.com/outfit-cover.jpg";
  const imageBuffer = await sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: "#d8c0a0",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, imageBuffer);

  const pdfBuffer = await buildWardrobePdf(
    [
      {
        id: "top-1",
        name: "Top",
        category: "top",
        imageUrl: "",
      },
    ],
    {
      locale: "en",
      outfit: {
        title: "Weekend",
        imageUrl,
        imageStale: true,
        report: buildReport(),
        reportStale: true,
      },
    },
  );

  expect(await getPdfPageCount(pdfBuffer)).toBe(3);
});

test("buildWardrobePdf supports image-only report-only and plain product PDFs", async (t) => {
  const imageUrl = "https://images.example.com/outfit-only.jpg";
  const imageBuffer = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 3,
      background: "#1c7c7c",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, imageBuffer);

  const imageOnly = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Image only", imageUrl },
  });
  const reportOnly = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Report only", report: buildReport() },
  });
  const productOnly = await buildWardrobePdf(
    [{ id: "top-1", name: "Top", imageUrl: "" }],
    {
      locale: "en",
    },
  );

  expect(await getPdfPageCount(imageOnly)).toBe(1);
  expect(await getPdfPageCount(reportOnly)).toBe(1);
  expect(await getPdfPageCount(productOnly)).toBe(1);
});

test("buildWardrobePdf paginates long outfit reports at the end", async () => {
  const longReport = buildReport({
    compatibility: {
      overallScore: 0.9,
      styleCoherence: 0.86,
      formalityCoherence: 0.88,
      seasonalCoherence: 0.8,
      colorCoherence: 0.92,
      mainStrengths: Array.from(
        { length: 90 },
        (_, index) =>
          `Strength ${index + 1}: this line intentionally has enough detail to wrap in the PDF report.`,
      ),
      mainRisks: [],
    },
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Long report", report: longReport },
  });

  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(1);
});

test("buildWardrobePdf wraps long report chips and issue suggestions", async () => {
  const wrappedReport = buildReport({
    seasonality: {
      primarySeasons: [
        "very_long_transitional_weather_label_that_forces_chip_wrapping",
        "another_long_weather_context_for_the_next_chip_row",
      ],
      temperatureBandC: { min: 5, max: 21 },
      seasonScore: 0.8,
    },
    styleProfile: {
      formalityLevel: "very_detailed_smart_casual_context",
      primaryStyle: "minimalist_layered_city_utility_with_extra_detail",
      styleScore: 0.85,
    },
    colorAnalysis: {
      paletteType: "muted_neutral_with_extended_accent_context",
      colorScore: 0.92,
    },
    issues: [
      { message: "", suggestion: "" },
      {
        message: "Layering may need adjustment.",
        suggestion:
          "Use a compact thermal layer under the jacket when the morning starts cold and remove it indoors after commuting.",
      },
    ],
  });

  const pdfBuffer = await buildWardrobePdf([], {
    locale: "en",
    outfit: { title: "Wrapped report", report: wrappedReport },
  });

  expect(Buffer.isBuffer(pdfBuffer)).toBeTruthy();
  expect(await getPdfPageCount(pdfBuffer)).toBeGreaterThan(0);
});

test("outfit pdf report helpers mirror desktop report labels and percentages", () => {
  const report = buildReport();

  expect(toPercent("bad")).toBe(null);
  expect(toPercent(-1)).toBe(0);
  expect(toPercent(2)).toBe(100);
  expect(formatReportValue("acceptable_with_notes")).toBe(
    "Acceptable With Notes",
  );
  expect(getReportTemperatureLabel(report, "en")).toBe("10–18°C");
  expect(
    getReportTemperatureLabel(
      { seasonality: { temperatureBandC: { min: 12 } } },
      "en",
    ),
  ).toBe("from 12°C");
  expect(
    getReportTemperatureLabel(
      { seasonality: { temperatureBandC: { max: 20 } } },
      "en",
    ),
  ).toBe("up to 20°C");
  expect(getReportTemperatureLabel({ seasonality: {} }, "en")).toBe(null);
  expect(getReportChipValues(report, "en")).toEqual([
    "10–18°C",
    "spring",
    "casual",
    "minimalistic",
    "neutral",
  ]);
  expect(getReportScoreRows(report, "en")).toEqual([
    expect.objectContaining({ key: "style", percent: 86 }),
    expect.objectContaining({ key: "color", percent: 92 }),
    expect.objectContaining({ key: "season", percent: 80 }),
    expect.objectContaining({ key: "formality", percent: 88 }),
    expect.objectContaining({ key: "overall", percent: 90 }),
  ]);
  expect(
    getReportScoreRows(
      {
        styleProfile: { styleScore: 0.7 },
        colorAnalysis: { colorScore: 0.6 },
        seasonality: { seasonScore: 0.5 },
      },
      "en",
    ),
  ).toEqual([
    expect.objectContaining({ key: "style", percent: 70 }),
    expect.objectContaining({ key: "color", percent: 60 }),
    expect.objectContaining({ key: "season", percent: 50 }),
  ]);
  expect(getReportVerdictLabel({}, "en")).toBe("Good match");
  expect(
    getReportVerdictLabel({ verdict: { status: "incomplete" } }, "en"),
  ).toBe("Incomplete");
  expect(
    getReportVerdictLabel(
      { verdict: { llmStatus: "valid", score: 0.5, status: "valid" } },
      "en",
    ),
  ).toBe("Incomplete");
  expect(
    getReportVerdictLabel(
      { verdict: { llmStatus: "incoherent", score: 0.5, status: "valid" } },
      "en",
    ),
  ).toBe("Needs work");
  expect(getScoreTone(null)).toBe("neutral");
  expect(getScoreTone(75)).toBe("success");
  expect(getScoreTone(60)).toBe("warning");
  expect(getScoreTone(59)).toBe("error");
  expect(outfitNeedsUnicodeFallback({ title: "Weekend" }, "en")).toBe(false);
  expect(outfitNeedsUnicodeFallback({ title: "Выходной" }, "en")).toBe(true);
  expect(outfitNeedsUnicodeFallback({ title: "Weekend" }, "ru")).toBe(true);
});
