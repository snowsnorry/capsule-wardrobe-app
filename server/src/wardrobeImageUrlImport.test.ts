import { createHash } from "node:crypto";
import { expect, test, vi } from "vitest";

import {
  WARDROBE_IMAGE_URL_MAX_BYTES,
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeImageUrl,
  normalizeWardrobeImageUploadUrls,
} from "./wardrobeImageUrlImport.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);

test("wardrobe image URL normalization accepts only safe HTTP image URLs", () => {
  expect(
    normalizeWardrobeImageUploadUrls("https://shop.example.com"),
  ).toBeNull();
  expect(
    normalizeWardrobeImageUploadUrls([
      " https://shop.example.com/product.jpg?sku=1 ",
      "http://shop.example.com/item.webp",
    ]),
  ).toEqual([
    "https://shop.example.com/product.jpg?sku=1",
    "http://shop.example.com/item.webp",
  ]);
  expect(normalizeWardrobeImageUploadUrls([])).toBeNull();
  expect(
    normalizeWardrobeImageUploadUrls([
      "https://shop.example.com/1.jpg",
      "https://shop.example.com/2.jpg",
      "https://shop.example.com/3.jpg",
      "https://shop.example.com/4.jpg",
      "https://shop.example.com/5.jpg",
      "https://shop.example.com/6.jpg",
    ]),
  ).toBeNull();
  expect(
    normalizeWardrobeImageUploadUrls(["ftp://shop.example.com/item.jpg"]),
  ).toBeNull();
  expect(
    normalizeWardrobeImageUploadUrls(["http://127.0.0.1/item.jpg"]),
  ).toBeNull();
  expect(
    normalizeWardrobeImageUploadUrls(["http://localhost/item.jpg"]),
  ).toBeNull();
});

test("wardrobe image URL download reads capped image responses", async () => {
  const lookupImpl = vi.fn(async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  const requestImpl = vi.fn(async () => ({
    buffer: tinyPng,
    headers: new Headers(),
    redirect: false as const,
    status: 200,
  }));

  const result = await downloadWardrobeImageUrl({
    imageUrl: "https://cdn.example.com/photos/linen-shirt.png?width=1200",
    lookupImpl,
    requestImpl,
  });

  expect(result).toMatchObject({
    imageUrl: "https://cdn.example.com/photos/linen-shirt.png?width=1200",
    mimeType: "image/png",
    originalName: "linen-shirt.png",
  });
  expect(result.buffer).toEqual(tinyPng);
  expect(lookupImpl).toHaveBeenCalledWith("cdn.example.com", {
    all: true,
    verbatim: true,
  });
  expect(requestImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      address: "93.184.216.34",
      family: 4,
      url: new URL("https://cdn.example.com/photos/linen-shirt.png?width=1200"),
    }),
  );
});

test("wardrobe image URL download rejects invalid and oversized responses", async () => {
  const lookupImpl = vi.fn(async () => [
    { address: "93.184.216.34", family: 4 },
  ]);

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "not a url",
    }),
  ).rejects.toThrow(/invalid_image_url/);

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/huge.png",
      lookupImpl,
      requestImpl: vi.fn(async () => ({
        buffer: Buffer.from(""),
        headers: new Headers({
          "Content-Length": String(WARDROBE_IMAGE_URL_MAX_BYTES + 1),
        }),
        redirect: false as const,
        status: 200,
      })),
    }),
  ).rejects.toThrow(/image_url_too_large/);

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/stream-huge.png",
      lookupImpl,
      requestImpl: vi.fn(async () => {
        throw new Error("image_url_too_large");
      }),
    }),
  ).rejects.toThrow(/image_url_too_large/);
});

test("wardrobe image URL download rejects failed or invalid image responses", async () => {
  const lookupImpl = vi.fn(async () => [
    { address: "93.184.216.34", family: 4 },
  ]);

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/missing.jpg",
      lookupImpl,
      requestImpl: vi.fn(async () => ({
        buffer: Buffer.from("missing"),
        headers: new Headers(),
        redirect: false as const,
        status: 404,
      })),
    }),
  ).rejects.toThrow(/image_url_fetch_failed_404/);

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/not-image.jpg",
      lookupImpl,
      requestImpl: vi.fn(async () => ({
        buffer: Buffer.from("nope"),
        headers: new Headers(),
        redirect: false as const,
        status: 200,
      })),
    }),
  ).rejects.toThrow(/image_url_invalid/);
});

test("wardrobe image URL download rejects private DNS results", async () => {
  const requestImpl = vi.fn();

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/private.png",
      lookupImpl: vi.fn(async () => [{ address: "10.0.0.7", family: 4 }]),
      requestImpl,
    }),
  ).rejects.toThrow(/unsafe_server_fetch_dns/);
  expect(requestImpl).not.toHaveBeenCalled();
});

test("wardrobe image URL download rejects redirects to literal IPs", async () => {
  const requestImpl = vi.fn(async () => ({
    headers: new Headers({ location: "http://127.0.0.1/private.png" }),
    location: "http://127.0.0.1/private.png",
    redirect: true as const,
    status: 302,
  }));

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/redirect.png",
      lookupImpl: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
      requestImpl,
    }),
  ).rejects.toThrow(/unsafe_server_fetch_redirect/);
  expect(requestImpl).toHaveBeenCalledTimes(1);
});

test("wardrobe image URL download rejects redirects to private DNS", async () => {
  const lookupImpl = vi
    .fn()
    .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
    .mockResolvedValueOnce([{ address: "192.168.1.10", family: 4 }]);
  const requestImpl = vi.fn(async () => ({
    headers: new Headers({ location: "https://private.example/image.png" }),
    location: "https://private.example/image.png",
    redirect: true as const,
    status: 302,
  }));

  await expect(
    downloadWardrobeImageUrl({
      imageUrl: "https://cdn.example.com/redirect.png",
      lookupImpl,
      requestImpl,
    }),
  ).rejects.toThrow(/unsafe_server_fetch_dns/);
  expect(lookupImpl).toHaveBeenNthCalledWith(2, "private.example", {
    all: true,
    verbatim: true,
  });
  expect(requestImpl).toHaveBeenCalledTimes(1);
});

test("wardrobe image URL remote source key is wardrobe scoped", () => {
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
