import { createHash } from "node:crypto";
import { beforeEach, expect, test, vi } from "vitest";

const promptImageDownloads = vi.hoisted(() => ({
  downloadProductImageAssets: vi.fn(),
}));

vi.mock("./ai/promptImageDownloads.js", () => promptImageDownloads);

import {
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeProductPageImage,
  extractOpenGraphImageUrl,
  fetchProductPageHtmlWithImpers,
  normalizeWardrobeProductPageUploadUrls,
  parseHtmlTagAttributes,
} from "./wardrobeProductPageImport.js";

beforeEach(() => {
  promptImageDownloads.downloadProductImageAssets.mockReset();
});

test("wardrobe product page URL normalization accepts only safe HTTP URLs", () => {
  expect(
    normalizeWardrobeProductPageUploadUrls("https://shop.example.com"),
  ).toBeNull();
  expect(
    normalizeWardrobeProductPageUploadUrls([
      " https://shop.example.com/product?sku=1 ",
      "http://shop.example.com/item",
    ]),
  ).toEqual([
    "https://shop.example.com/product?sku=1",
    "http://shop.example.com/item",
  ]);
  expect(normalizeWardrobeProductPageUploadUrls([])).toBeNull();
  expect(
    normalizeWardrobeProductPageUploadUrls([
      "https://shop.example.com/1",
      "https://shop.example.com/2",
      "https://shop.example.com/3",
      "https://shop.example.com/4",
      "https://shop.example.com/5",
      "https://shop.example.com/6",
    ]),
  ).toBeNull();
  expect(
    normalizeWardrobeProductPageUploadUrls(["ftp://shop.example.com/item"]),
  ).toBeNull();
  expect(
    normalizeWardrobeProductPageUploadUrls(["http://127.0.0.1/item"]),
  ).toBeNull();
  expect(
    normalizeWardrobeProductPageUploadUrls(["http://localhost/item"]),
  ).toBeNull();
});

test("wardrobe product page meta attribute parser handles quotes and entities", () => {
  expect(
    parseHtmlTagAttributes(
      "<meta content=\"https://cdn.example.com/a&amp;b.jpg\" property='og:image'>",
    ),
  ).toEqual({
    content: "https://cdn.example.com/a&b.jpg",
    property: "og:image",
  });
  expect(
    parseHtmlTagAttributes(
      '<meta PROPERTY=og:image content="&quot;shirt&quot; &#39;linen&#39; &lt;img&gt;">',
    ),
  ).toEqual({
    content: "\"shirt\" 'linen' <img>",
    property: "og:image",
  });
});

test("wardrobe product page importer extracts og image with flexible attributes", () => {
  const html = `
    <html><head>
      <meta content="/images/linen-shirt.jpg?fit=cover&amp;w=1200" property="og:image" />
    </head></html>
  `;

  expect(extractOpenGraphImageUrl(html, "https://shop.example.com/p/1")).toBe(
    "https://shop.example.com/images/linen-shirt.jpg?fit=cover&w=1200",
  );
  expect(
    extractOpenGraphImageUrl(
      '<meta PROPERTY="og:image:url" CONTENT="https://cdn.example.com/item.webp">',
      "https://shop.example.com/p/1",
    ),
  ).toBe("https://cdn.example.com/item.webp");
  expect(
    extractOpenGraphImageUrl(
      '<meta property="og:image" content="http://127.0.0.1/private.jpg">',
      "https://shop.example.com/p/1",
    ),
  ).toBe("");
  expect(extractOpenGraphImageUrl("", "https://shop.example.com/p/1")).toBe("");
  expect(
    extractOpenGraphImageUrl(
      '<meta property="og:title" content="Linen shirt"><meta property="og:image">',
      "https://shop.example.com/p/1",
    ),
  ).toBe("");
});

test("wardrobe product page fetch uses impers chrome impersonation", async () => {
  const getImpl = vi.fn(async () => ({
    contentType: "text/html; charset=utf-8",
    ok: true,
    status: 200,
    text: "<html>Product</html>",
    url: "https://shop.example.com/final",
  }));

  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: getImpl as never,
      url: "https://shop.example.com/product",
    }),
  ).resolves.toEqual({
    html: "<html>Product</html>",
    url: "https://shop.example.com/final",
  });
  expect(getImpl).toHaveBeenCalledWith("https://shop.example.com/product", {
    allowRedirects: true,
    impersonate: "chrome",
    maxRedirects: 5,
    timeout: 30,
  });
});

test("wardrobe product page fetch rejects non-HTML and failed responses", async () => {
  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: vi.fn() as never,
      url: "ftp://shop.example.com/product",
    }),
  ).rejects.toThrow(/invalid_product_page_url/);

  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: vi.fn(async () => ({
        contentType: "application/json",
        ok: true,
        status: 200,
        text: "{}",
        url: "https://shop.example.com/product",
      })) as never,
      url: "https://shop.example.com/product",
    }),
  ).rejects.toThrow(/product_page_not_html/);

  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: vi.fn(async () => ({
        contentType: "text/html",
        ok: false,
        status: 403,
        text: "",
        url: "https://shop.example.com/product",
      })) as never,
      url: "https://shop.example.com/product",
    }),
  ).rejects.toThrow(/product_page_fetch_failed_403/);

  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: vi.fn(async () => ({
        contentType: "text/html",
        ok: true,
        status: 200,
        text: "   ",
        url: "https://shop.example.com/product",
      })) as never,
      url: "https://shop.example.com/product",
    }),
  ).rejects.toThrow(/product_page_empty_html/);
});

test("wardrobe product page fetch handles header content type and unsafe final URLs", async () => {
  const getImpl = vi.fn(async () => ({
    headers: { get: () => "application/xhtml+xml; charset=utf-8" },
    ok: true,
    status: 200,
    text: "<html>Product</html>",
    url: "http://127.0.0.1/redirected",
  }));

  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: getImpl as never,
      url: "https://shop.example.com/product",
    }),
  ).resolves.toEqual({
    html: "<html>Product</html>",
    url: "https://shop.example.com/product",
  });
});

test("wardrobe product page image download maps assets and fallback names", async () => {
  promptImageDownloads.downloadProductImageAssets.mockResolvedValue({
    "product-page-image": {
      buffer: Buffer.from("image"),
      mimeType: "image/webp",
    },
  });

  const result = await downloadWardrobeProductPageImage({
    imageUrl: "https://cdn.example.com/photos/linen-shirt.webp?width=1200",
  });

  expect(result).toMatchObject({
    imageUrl: "https://cdn.example.com/photos/linen-shirt.webp?width=1200",
    mimeType: "image/webp",
    originalName: "linen-shirt.webp",
  });
  expect(result.buffer).toEqual(Buffer.from("image"));
  expect(promptImageDownloads.downloadProductImageAssets).toHaveBeenCalledWith([
    {
      category: "uploaded",
      id: "product-page-image",
      imageUrl: "https://cdn.example.com/photos/linen-shirt.webp?width=1200",
    },
  ]);

  const fallback = await downloadWardrobeProductPageImage({
    imageUrl: "not a url",
  });
  expect(fallback.originalName).toBe("product-page-image.jpg");
});

test("wardrobe product page image download rejects missing assets", async () => {
  promptImageDownloads.downloadProductImageAssets.mockResolvedValue({});

  await expect(
    downloadWardrobeProductPageImage({
      imageUrl: "https://cdn.example.com/missing.jpg",
    }),
  ).rejects.toThrow(/product_page_image_download_failed/);
});

test("wardrobe product page remote source key is wardrobe scoped", () => {
  const buffer = Buffer.from("downloaded image");
  const digest = createHash("sha256").update(buffer).digest("hex");
  const key = buildRemoteWardrobeImageSourceKey({
    email: "USER@Example.COM",
    image: { buffer },
  });

  expect(key).toMatch(
    new RegExp(`^wardrobe/[a-f0-9]{16}/[a-f0-9-]+-${digest}\\.webp$`),
  );
});
