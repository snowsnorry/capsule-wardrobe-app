import { createHash } from "node:crypto";
import { expect, test, vi } from "vitest";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);

import {
  PRODUCT_PAGE_HTML_MAX_BYTES,
  PRODUCT_PAGE_IMAGE_MAX_BYTES,
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeProductPageImage,
  extractOpenGraphImageUrl,
  fetchProductPageHtmlWithImpers,
  normalizeWardrobeProductPageUploadUrls,
  parseHtmlTagAttributes,
} from "./wardrobeProductPageImport.js";

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
    contentCallback: expect.any(Function),
    impersonate: "chrome",
    maxRedirects: 5,
    stream: true,
    timeout: 30,
  });
});

test("wardrobe product page fetch returns direct image URL downloads", async () => {
  const getImpl = vi.fn(async () => ({
    content: tinyPng,
    contentType: "image/png",
    ok: true,
    status: 200,
    text: "",
    url: "https://cdn.example.com/products/linen-shirt.png?width=1200",
  }));

  const result = await fetchProductPageHtmlWithImpers({
    getImpl: getImpl as never,
    url: "https://cdn.example.com/products/linen-shirt.png",
  });

  expect(result).toEqual({
    type: "image",
    url: "https://cdn.example.com/products/linen-shirt.png?width=1200",
    image: {
      buffer: tinyPng,
      imageUrl: "https://cdn.example.com/products/linen-shirt.png?width=1200",
      mimeType: "image/png",
      originalName: "linen-shirt.png",
    },
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
        content: Buffer.from("not an image"),
        contentType: "image/jpeg",
        ok: true,
        status: 200,
        text: "",
        url: "https://cdn.example.com/product.jpg",
      })) as never,
      url: "https://cdn.example.com/product.jpg",
    }),
  ).rejects.toThrow(/product_page_image_invalid/);

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

test("wardrobe product page fetch enforces HTML byte caps", async () => {
  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: vi.fn(async () => ({
        contentType: "text/html",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-length"
              ? String(PRODUCT_PAGE_HTML_MAX_BYTES + 1)
              : "",
        },
        ok: true,
        status: 200,
        text: "<html>too large</html>",
        url: "https://shop.example.com/product",
      })) as never,
      url: "https://shop.example.com/product",
    }),
  ).rejects.toThrow(/product_page_html_too_large/);

  await expect(
    fetchProductPageHtmlWithImpers({
      getImpl: vi.fn(async (_url, options) => {
        const chunk = Buffer.alloc(256 * 1024);
        options?.contentCallback?.(chunk);
        options?.contentCallback?.(chunk);
        options?.contentCallback?.(Buffer.from("overflow"));
        return {
          contentType: "text/html",
          ok: true,
          status: 200,
          text: "",
          url: "https://shop.example.com/product",
        };
      }) as never,
      url: "https://shop.example.com/product",
    }),
  ).rejects.toThrow(/product_page_html_too_large/);
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

test("wardrobe product page image download reads capped image responses", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => new Response(tinyPng)) as never;
  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await downloadWardrobeProductPageImage({
    imageUrl: "https://cdn.example.com/photos/linen-shirt.png?width=1200",
  });

  expect(result).toMatchObject({
    imageUrl: "https://cdn.example.com/photos/linen-shirt.png?width=1200",
    mimeType: "image/png",
    originalName: "linen-shirt.png",
  });
  expect(result.buffer).toEqual(tinyPng);
});

test("wardrobe product page image download rejects invalid and oversized responses", async (t) => {
  const originalFetch = globalThis.fetch;
  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  await expect(
    downloadWardrobeProductPageImage({
      imageUrl: "not a url",
    }),
  ).rejects.toThrow(/invalid_product_page_image_url/);

  globalThis.fetch = vi.fn(
    async () =>
      new Response(Buffer.from(""), {
        headers: {
          "Content-Length": String(PRODUCT_PAGE_IMAGE_MAX_BYTES + 1),
        },
      }),
  ) as never;

  await expect(
    downloadWardrobeProductPageImage({
      imageUrl: "https://cdn.example.com/huge.png",
    }),
  ).rejects.toThrow(/product_page_image_too_large/);

  globalThis.fetch = vi.fn(async () => {
    let sent = 0;
    return new Response(
      new ReadableStream({
        pull(controller) {
          sent += 1;
          if (sent > 11) {
            controller.close();
            return;
          }
          controller.enqueue(Buffer.alloc(1024 * 1024));
        },
      }),
    );
  }) as never;

  await expect(
    downloadWardrobeProductPageImage({
      imageUrl: "https://cdn.example.com/stream-huge.png",
    }),
  ).rejects.toThrow(/product_page_image_too_large/);
});

test("wardrobe product page image download rejects failed or invalid image responses", async (t) => {
  const originalFetch = globalThis.fetch;
  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = vi.fn(
    async () =>
      new Response(Buffer.from("missing"), {
        status: 404,
      }),
  ) as never;

  await expect(
    downloadWardrobeProductPageImage({
      imageUrl: "https://cdn.example.com/missing.jpg",
    }),
  ).rejects.toThrow(/product_page_image_fetch_failed_404/);

  globalThis.fetch = vi.fn(
    async () => new Response(Buffer.from("nope")),
  ) as never;

  await expect(
    downloadWardrobeProductPageImage({
      imageUrl: "https://cdn.example.com/not-image.jpg",
    }),
  ).rejects.toThrow(/product_page_image_invalid/);
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
