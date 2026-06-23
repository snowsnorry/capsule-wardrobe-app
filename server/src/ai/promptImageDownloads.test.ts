import { test, expect, vi } from "vitest";
import type { TestContext } from "vitest";
import sharp from "sharp";
import {
  downloadProductImageAssets,
  downloadPromptImageAsset,
  setPromptImageDownloadBufferImplForTests,
} from "./promptImageDownloads.js";
import {
  createFixtureBuffer,
  createItems,
  withCachedImage,
} from "../test/promptImageFixtures.js";
import type { ServerImageDownloadBufferImpl } from "../serverImageDownload.js";

function createImageDownloadResult(
  buffer: Buffer,
  {
    headers = {},
    status = 200,
    url = "https://images.example.com/item.jpg",
  }: {
    headers?: HeadersInit;
    status?: number;
    url?: string;
  } = {},
) {
  return {
    buffer,
    headers: new Headers(headers),
    status,
    url,
  };
}

function usePromptImageDownloader(
  testContext: TestContext,
  impl: ServerImageDownloadBufferImpl,
) {
  setPromptImageDownloadBufferImplForTests(impl);
  testContext.onTestFinished(() => {
    setPromptImageDownloadBufferImplForTests(null);
  });
}

function mutePromptImageWarnings(testContext: TestContext) {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  testContext.onTestFinished(() => {
    warnSpy.mockRestore();
  });
}

test("downloadProductImageAssets normalizes downloaded files to jpeg", async (t) => {
  const transparentBuffer = await sharp({
    create: {
      width: 300,
      height: 180,
      channels: 4,
      background: { r: 10, g: 120, b: 240, alpha: 0.3 },
    },
  })
    .png()
    .toBuffer();
  usePromptImageDownloader(t, async ({ url }) =>
    createImageDownloadResult(transparentBuffer, {
      headers: { "content-type": "image/png" },
      url,
    }),
  );

  const assets = await downloadProductImageAssets(createItems("top", 1));
  const asset = assets["top-1"];

  expect(asset).toBeTruthy();
  expect(asset.mimeType).toBe("image/jpeg");
  expect(asset.source).toBe("download");
  expect(Buffer.isBuffer(asset.buffer)).toBeTruthy();
  const metadata = await sharp(asset.buffer).metadata();
  expect(metadata.format).toBe("jpeg");
});

test("downloadProductImageAssets uses local cached jpeg before remote fetch", async (t) => {
  const imageUrl =
    "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  const cachedJpeg = await sharp({
    create: {
      width: 1000,
      height: 700,
      channels: 3,
      background: "#1d4ed8",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await withCachedImage(t, imageUrl, cachedJpeg);
  usePromptImageDownloader(t, async () => {
    throw new Error("fetch_should_not_be_called");
  });

  const assets = await downloadProductImageAssets([
    {
      id: "top-1",
      category: "top",
      imageUrl: imageUrl,
    },
  ]);

  const asset = assets["top-1"];
  expect(asset).toBeTruthy();
  expect(asset.source).toBe("cache");
  expect(asset.originalImageUrl).toBe(imageUrl);
  const metadata = await sharp(asset.buffer).metadata();
  expect(metadata.format).toBe("jpeg");
});

test("downloadProductImageAssets replaces width placeholder in image url before fetch", async (t) => {
  const fixtureBuffer = await createFixtureBuffer("#228833");
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    requestedUrls.push(url);
    return createImageDownloadResult(fixtureBuffer, { url });
  });

  await downloadProductImageAssets([
    {
      id: "top-1",
      category: "top",
      imageUrl: "https://static.zara.net/image.jpg?ts=1773310573314&w={width}",
    },
  ]);

  expect(requestedUrls.length).toBe(1);
  expect(requestedUrls[0]).toBe(
    "https://static.zara.net/image.jpg?ts=1773310573314&w=1000",
  );
});

test("downloadPromptImageAsset uses thumbnail before original image", async (t) => {
  const fixtureBuffer = await createFixtureBuffer("#22aa66");
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    requestedUrls.push(url);
    return createImageDownloadResult(fixtureBuffer, { url });
  });

  const asset = await downloadPromptImageAsset({
    id: "item-1",
    category: "top",
    imageUrl: "https://images.example.com/item.jpg",
    thumbnailUrl: "https://images.example.com/item_320.webp",
  });

  expect(requestedUrls).toEqual(["https://images.example.com/item_320.webp"]);
  expect(asset.status).toBe("downloaded");
  expect(asset.imageUrl).toBe("https://images.example.com/item_320.webp");
  expect(asset.originalImageUrl).toBe("https://images.example.com/item.jpg");
});

test("downloadPromptImageAsset falls back to original after thumbnail 404", async (t) => {
  mutePromptImageWarnings(t);
  const fixtureBuffer = await createFixtureBuffer("#3355cc");
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    const requestedUrl = url;
    requestedUrls.push(requestedUrl);
    if (requestedUrl.endsWith("_320.webp")) {
      return createImageDownloadResult(Buffer.from("missing"), {
        status: 404,
        url,
      });
    }
    return createImageDownloadResult(fixtureBuffer, { url });
  });

  const asset = await downloadPromptImageAsset({
    id: "item-1",
    category: "top",
    imageUrl: "https://images.example.com/item.jpg",
    thumbnailUrl: "https://images.example.com/item_320.webp",
  });

  expect(requestedUrls).toEqual([
    "https://images.example.com/item_320.webp",
    "https://images.example.com/item.jpg",
  ]);
  expect(asset.status).toBe("downloaded");
  expect(asset.imageUrl).toBe("https://images.example.com/item.jpg");
  expect(asset.originalImageUrl).toBe("https://images.example.com/item.jpg");
});

test("downloadPromptImageAsset falls back to original after thumbnail pixel limit", async (t) => {
  mutePromptImageWarnings(t);
  const oversizedThumbnail = await sharp({
    create: {
      width: 5000,
      height: 4000,
      channels: 3,
      background: "#111111",
    },
  })
    .jpeg()
    .toBuffer();
  const fixtureBuffer = await createFixtureBuffer("#aa5533");
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    const requestedUrl = url;
    requestedUrls.push(requestedUrl);
    if (requestedUrl.endsWith("_320.webp")) {
      return createImageDownloadResult(oversizedThumbnail, { url });
    }
    return createImageDownloadResult(fixtureBuffer, { url });
  });

  const asset = await downloadPromptImageAsset({
    id: "item-1",
    category: "top",
    imageUrl: "https://images.example.com/item.jpg",
    thumbnailUrl: "https://images.example.com/item_320.webp",
  });

  expect(requestedUrls).toEqual([
    "https://images.example.com/item_320.webp",
    "https://images.example.com/item.jpg",
  ]);
  expect(asset.status).toBe("downloaded");
  expect(asset.imageUrl).toBe("https://images.example.com/item.jpg");
});

test("downloadPromptImageAsset skips item after thumbnail and original fail", async (t) => {
  mutePromptImageWarnings(t);
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    const requestedUrl = url;
    requestedUrls.push(requestedUrl);
    if (requestedUrl.endsWith("_320.webp")) {
      throw new Error("socket_hang_up");
    }
    return createImageDownloadResult(Buffer.from("unavailable"), {
      status: 503,
      url,
    });
  });

  const asset = await downloadPromptImageAsset({
    id: "item-1",
    category: "top",
    imageUrl: "https://images.example.com/item.jpg",
    thumbnailUrl: "https://images.example.com/item_320.webp",
  });

  expect(requestedUrls).toEqual([
    "https://images.example.com/item_320.webp",
    "https://images.example.com/item.jpg",
  ]);
  expect(asset).toMatchObject({
    status: "skipped",
    reason: "http_503",
    imageUrl: "https://images.example.com/item.jpg",
    originalImageUrl: "https://images.example.com/item.jpg",
  });
});

test("downloadPromptImageAsset falls back to original after thumbnail byte cap", async (t) => {
  mutePromptImageWarnings(t);
  const fixtureBuffer = await createFixtureBuffer("#33aa77");
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    requestedUrls.push(url);
    if (url.endsWith("_320.webp")) {
      throw new Error("image_download_too_large");
    }
    return createImageDownloadResult(fixtureBuffer, { url });
  });

  const asset = await downloadPromptImageAsset({
    id: "item-1",
    category: "top",
    imageUrl: "https://images.example.com/item.jpg",
    thumbnailUrl: "https://images.example.com/item_320.webp",
  });

  expect(requestedUrls).toEqual([
    "https://images.example.com/item_320.webp",
    "https://images.example.com/item.jpg",
  ]);
  expect(asset.status).toBe("downloaded");
  expect(asset.imageUrl).toBe("https://images.example.com/item.jpg");
});

test("downloadPromptImageAsset skips item after thumbnail and original byte caps", async (t) => {
  mutePromptImageWarnings(t);
  const requestedUrls: string[] = [];

  usePromptImageDownloader(t, async ({ url }) => {
    requestedUrls.push(url);
    throw new Error("image_download_too_large");
  });

  const asset = await downloadPromptImageAsset({
    id: "item-1",
    category: "top",
    imageUrl: "https://images.example.com/item.jpg",
    thumbnailUrl: "https://images.example.com/item_320.webp",
  });

  expect(requestedUrls).toEqual([
    "https://images.example.com/item_320.webp",
    "https://images.example.com/item.jpg",
  ]);
  expect(asset).toMatchObject({
    status: "skipped",
    reason: "image_download_too_large",
    imageUrl: "https://images.example.com/item.jpg",
  });
});
