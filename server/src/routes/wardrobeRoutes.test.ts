import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";
import { buildUploadedWardrobeItemImageKeys } from "./wardrobeUploadedItemUpdateRoute.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);

async function requestMultipart(baseUrl, pathname, formData) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      cookie: AUTH_COOKIE,
      "X-CSRF-Token": CSRF_TOKEN,
      origin: TEST_CLIENT_ORIGIN,
    },
    body: formData,
  });
  const text = await response.text();
  return {
    response,
    json: text && text.startsWith("{") ? JSON.parse(text) : null,
    text,
  };
}

function parseSseEvents(text: string) {
  return text
    .trim()
    .split(/\n\n+/)
    .filter(Boolean)
    .map((chunk) => {
      const event =
        chunk
          .split("\n")
          .find((line) => line.startsWith("event: "))
          ?.slice("event: ".length) || "message";
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("\n");
      return {
        event,
        data: data ? JSON.parse(data) : {},
      };
    });
}

function buildUploadForm(
  files: Array<{ bytes?: Buffer; name?: string; type?: string }> = [
    { bytes: tinyPng, name: "shirt.png", type: "image/png" },
  ],
) {
  const form = new FormData();
  for (const file of files) {
    const bytes = file.bytes || tinyPng;
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    form.append(
      "images",
      new Blob([arrayBuffer], {
        type: file.type || "image/png",
      }),
      file.name || "shirt.png",
    );
  }
  return form;
}

test("uploaded wardrobe image key builder handles camel fields invalid URLs and duplicates", () => {
  expect(
    buildUploadedWardrobeItemImageKeys({
      imageUrl: "https://images.example.com/wardrobe/profile/image_clean.png",
      rawImageUrl: "https://images.example.com/wardrobe/profile/image.webp",
    }),
  ).toEqual([
    "wardrobe/profile/image.webp",
    "wardrobe/profile/image_clean.png",
    "wardrobe/profile/image_clean_320.webp",
    "wardrobe/profile/image_clean_480.webp",
    "wardrobe/profile/image_clean_640.webp",
  ]);
  expect(
    buildUploadedWardrobeItemImageKeys({
      image_url: "not a url",
      raw_image_url: "not a url",
    }),
  ).toEqual([]);
  expect(
    buildUploadedWardrobeItemImageKeys({
      image_url: "https://images.example.com/wardrobe/profile/image.webp",
      raw_image_url: "https://images.example.com/wardrobe/profile/image.webp",
    }),
  ).toEqual([
    "wardrobe/profile/image.webp",
    "wardrobe/profile/image_320.webp",
    "wardrobe/profile/image_480.webp",
    "wardrobe/profile/image_640.webp",
  ]);
});

test("wardrobe routes list and save user wardrobe items", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "list", payload });
        return [
          {
            createdAt: "2026-05-01T00:00:00.000Z",
            email: "person@example.com",
            id: "wardrobe-1",
            productId: "product-1",
            profileEmail: "person@example.com",
            url: "https://example.com/1",
            source: "from_catalog",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      saveWardrobeItemFromCatalogImpl: async (payload) => {
        calls.push({ type: "save", payload });
        return {
          created_at: "2026-05-01T00:00:00.000Z",
          id: "wardrobe-1",
          product_id: "product-1",
          profile_email: "person@example.com",
          url: payload.url,
          source: "from_catalog",
          updated_at: "2026-05-01T00:00:00.000Z",
        };
      },
      deleteWardrobeItemFromCatalogImpl: async (payload) => {
        calls.push({ type: "delete", payload });
        return true;
      },
    },
  });

  const list = await requestJson(
    baseUrl,
    "/wardrobe/items?source=from_catalog",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(list.response.status).toBe(200);
  expect(list.json).toEqual({
    ok: true,
    items: [
      {
        id: "wardrobe-1",
        url: "https://example.com/1",
        source: "from_catalog",
      },
    ],
  });

  const save = await requestJson(baseUrl, "/wardrobe/items/from-catalog", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { url: "https://example.com/1" },
  });
  expect(save.response.status).toBe(201);
  expect(save.json).toEqual({
    ok: true,
    item: {
      id: "wardrobe-1",
      url: "https://example.com/1",
      source: "from_catalog",
    },
  });

  const deleted = await requestJson(baseUrl, "/wardrobe/items/from-catalog", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { url: "https://example.com/1" },
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true, removed: true });

  expect(calls).toEqual([
    {
      type: "list",
      payload: { email: "person@example.com", source: "from_catalog" },
    },
    {
      type: "save",
      payload: { email: "person@example.com", url: "https://example.com/1" },
    },
    {
      type: "delete",
      payload: { email: "person@example.com", url: "https://example.com/1" },
    },
  ]);
});

test("wardrobe routes update uploaded item details", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateUploadedWardrobeItemDetailsImpl: async (payload) => {
        calls.push(payload);
        return {
          id: payload.id,
          profileEmail: payload.email,
          email: payload.email,
          source: "uploaded",
          updatedAt: "2026-05-01T00:00:00.000Z",
          ...payload.details,
        };
      },
    },
  });

  const update = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-1",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        name: "Updated shirt",
        description: "Button-front shirt",
        brand: "",
        audience: "unisex",
        category: "top",
        season: ["summer"],
        formality_level: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        color_base: ["white"],
        pattern: "solid",
        finish: null,
        composition: ["linen", "cotton"],
        silhouette: null,
        fit: "regular",
        closure_type: ["button"],
      },
    },
  );

  expect(update.response.status).toBe(200);
  expect(update.json).toEqual({
    ok: true,
    item: {
      id: "uploaded-1",
      source: "uploaded",
      name: "Updated shirt",
      description: "Button-front shirt",
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formality_level: ["casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      color_base: ["white"],
      pattern: "solid",
      finish: null,
      composition: "linen, cotton",
      silhouette: null,
      fit: "regular",
      closure_type: ["button"],
    },
  });
  expect(calls).toEqual([
    {
      email: "person@example.com",
      id: "uploaded-1",
      details: {
        name: "Updated shirt",
        description: "Button-front shirt",
        brand: null,
        audience: "all",
        category: "top",
        season: ["summer"],
        formality_level: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        color_base: ["white"],
        pattern: "solid",
        finish: null,
        composition: "linen, cotton",
        silhouette: null,
        fit: "regular",
        closure_type: ["button"],
      },
    },
  ]);
});

test("wardrobe uploaded item updates reject invalid payloads and missing items", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateUploadedWardrobeItemDetailsImpl: async () => null,
    },
  });

  const invalid = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-1",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        name: "",
        audience: "unisex",
        category: "top",
        season: ["summer"],
      },
    },
  );
  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid_payload" });

  const missing = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-1",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        name: "Updated shirt",
        audience: "women",
        category: "top",
        season: ["summer"],
      },
    },
  );
  expect(missing.response.status).toBe(404);
  expect(missing.json).toEqual({ error: "not_found" });
});

test("wardrobe routes delete uploaded items and best-effort cleanup R2 images", async (t) => {
  const calls: Array<{ type: string; payload?: unknown }> = [];
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      deleteUploadedWardrobeItemImpl: async (payload) => {
        calls.push({ type: "deleteUploaded", payload });
        return {
          id: payload.id,
          image_url:
            "https://images.example.com/wardrobe/profile/image_clean.png",
          raw_image_url:
            "https://images.example.com/wardrobe/profile/image.webp",
          source: "uploaded",
        };
      },
      deleteR2ObjectsImpl: async (payload) => {
        calls.push({ type: "deleteR2", payload });
        if (calls.filter((call) => call.type === "deleteR2").length === 2) {
          throw new Error("r2_failed");
        }
        return { deleted: payload.keys.length };
      },
    },
  });

  const forbidden = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-1",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
    },
  );
  expect(forbidden.response.status).toBe(403);

  const deleted = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-1",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true, removed: true });

  const deletedWithR2Failure = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-2",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(deletedWithR2Failure.response.status).toBe(200);
  expect(deletedWithR2Failure.json).toEqual({ ok: true, removed: true });
  expect(consoleError).toHaveBeenCalled();

  expect(calls).toEqual([
    {
      type: "deleteUploaded",
      payload: { email: "person@example.com", id: "uploaded-1" },
    },
    {
      type: "deleteR2",
      payload: {
        keys: [
          "wardrobe/profile/image.webp",
          "wardrobe/profile/image_clean.png",
          "wardrobe/profile/image_clean_320.webp",
          "wardrobe/profile/image_clean_480.webp",
          "wardrobe/profile/image_clean_640.webp",
        ],
      },
    },
    {
      type: "deleteUploaded",
      payload: { email: "person@example.com", id: "uploaded-2" },
    },
    {
      type: "deleteR2",
      payload: {
        keys: [
          "wardrobe/profile/image.webp",
          "wardrobe/profile/image_clean.png",
          "wardrobe/profile/image_clean_320.webp",
          "wardrobe/profile/image_clean_480.webp",
          "wardrobe/profile/image_clean_640.webp",
        ],
      },
    },
  ]);
});

test("wardrobe uploaded item delete reports not removed when row is missing", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      deleteUploadedWardrobeItemImpl: async () => null,
      deleteR2ObjectsImpl: async () => {
        throw new Error("should_not_delete_r2");
      },
    },
  });

  const deleted = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/missing",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );

  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true, removed: false });
});

test("wardrobe routes export filtered wardrobe items as PDF", async (t) => {
  const calls: unknown[] = [];
  let pdfLocale = "";
  let pdfItems: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "list", payload });
        return [
          {
            id: "wardrobe-1",
            name: "Saved shirt",
            image_url: "https://example.com/1.jpg",
            formality_level: "casual",
            color_base: ["white"],
            is_neutral: true,
            closure_type: "buttons",
            url: "https://example.com/1",
            source: "uploaded",
          },
        ];
      },
      buildWardrobePdfInChildImpl: async (items, locale) => {
        pdfItems = items;
        pdfLocale = locale;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(
    baseUrl,
    "/wardrobe/items/pdf?source=uploaded",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );

  expect(pdf.response.status).toBe(200);
  expect(pdf.response.headers.get("content-type")).toMatch(/application\/pdf/);
  expect(pdf.response.headers.get("content-disposition")).toBe(
    `attachment; filename="My-Wardrobe.pdf"; filename*=UTF-8''${encodeURIComponent("My Wardrobe.pdf")}`,
  );
  expect(pdf.json).toBe("pdf");
  expect(pdfLocale).toBe("en");
  expect(pdfItems).toEqual([
    expect.objectContaining({
      id: "wardrobe-1",
      name: "Saved shirt",
      imageUrl: "https://example.com/1.jpg",
      formalityLevel: "casual",
      colorBase: ["white"],
      isNeutral: true,
      closureType: "buttons",
      url: "https://example.com/1",
      source: "uploaded",
    }),
  ]);
  expect(calls).toEqual([
    {
      type: "list",
      payload: { email: "person@example.com", source: "uploaded" },
    },
  ]);
});

test("wardrobe upload route processes images and creates uploaded items", async (t) => {
  const calls: unknown[] = [];
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: null,
    audience: "women",
    category: "top",
    season: ["summer"],
    formality_level: ["smart_casual"],
    style: [],
    occasions: [],
    color_base: ["white"],
    is_neutral: true,
    pattern: "solid",
    finish: null,
    composition: "linen",
    silhouette: null,
    fit: "regular",
    closure_type: ["button"],
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      normalizeWardrobeUploadImagesInChildImpl: async (images) => {
        calls.push({
          type: "normalize",
          images: images.map((image) => ({
            mimeType: image.mimeType,
            originalName: image.originalName,
            size: image.buffer.length,
          })),
        });
        return images.map((image) => ({
          buffer: Buffer.from("normalized-webp"),
          mimeType: "image/webp",
          originalName: image.originalName,
          width: 800,
          height: 1000,
          size: 15,
        }));
      },
      uploadWardrobeImageToR2Impl: async (payload) => {
        calls.push({
          type: "upload",
          email: payload.email,
          buffer: payload.buffer.toString("utf8"),
        });
        return {
          key: "wardrobe/profile/image.webp",
          url: "https://images.example.com/wardrobe/profile/image.webp",
          digest: "digest",
        };
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", payload });
        return [
          {
            id: "wardrobe-upload-1",
            profile_email: "person@example.com",
            image_url: payload.imageUrls[0],
            raw_image_url: payload.imageUrls[0],
            source: "uploaded",
            processing_status: "uploaded",
            created_at: "2026-05-01T00:00:00.000Z",
            updated_at: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      analyzeWardrobeImageUrlImpl: async (payload) => {
        calls.push({ type: "analyze", payload });
        return {
          hasMetadata: true,
          metadata,
          rawResponse: JSON.stringify(metadata),
        };
      },
      cleanupUploadedWardrobeItemImageImpl: async (payload) => {
        calls.push({
          type: "cleanup",
          payload: {
            email: payload.email,
            imageUrl: payload.imageUrl,
            sourceBuffer: payload.sourceBuffer.toString("utf8"),
            sourceFilename: payload.sourceFilename,
            sourceKey: payload.sourceKey,
            sourceMimeType: payload.sourceMimeType,
          },
        });
        return {
          cleanImage: {
            key: "wardrobe/profile/image_clean.png",
            url: "https://images.example.com/wardrobe/profile/image_clean.png",
            digest: "clean-digest",
          },
          thumbnails: [],
        };
      },
      updateUploadedWardrobeItemMetadataImpl: async (payload) => {
        calls.push({ type: "updateMetadata", payload });
        return {
          id: payload.id,
          image_url: payload.imageUrl,
          raw_image_url:
            "https://images.example.com/wardrobe/profile/image.webp",
          source: "uploaded",
          processing_status: payload.processingStatus,
          ...payload.metadata,
        };
      },
    },
  });

  const upload = await requestMultipart(
    baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm([{ bytes: tinyPng, name: "shirt.png", type: "image/png" }]),
  );

  expect(upload.response.status).toBe(200);
  expect(upload.response.headers.get("content-type")).toMatch(
    /text\/event-stream/,
  );
  const events = parseSseEvents(upload.text);
  expect(events.map((event) => event.event)).toEqual([
    "progress",
    "progress",
    "progress",
    "complete",
  ]);
  expect(events.at(-1)?.data).toEqual({
    ok: true,
    total: 1,
    uploaded: 1,
    completedSteps: 3,
    metadataProcessed: 1,
    imageProcessed: 1,
    failed: 0,
    items: [
      expect.objectContaining({
        id: "wardrobe-upload-1",
        name: "Linen shirt",
        image_url:
          "https://images.example.com/wardrobe/profile/image_clean.png",
        raw_image_url: "https://images.example.com/wardrobe/profile/image.webp",
        source: "uploaded",
        processing_status: "ready",
      }),
    ],
  });
  expect(calls).toEqual([
    {
      type: "normalize",
      images: [
        {
          mimeType: "image/png",
          originalName: "shirt.png",
          size: tinyPng.length,
        },
      ],
    },
    {
      type: "upload",
      email: "person@example.com",
      buffer: "normalized-webp",
    },
    {
      type: "saveUploaded",
      payload: {
        email: "person@example.com",
        imageUrls: ["https://images.example.com/wardrobe/profile/image.webp"],
      },
    },
    {
      type: "analyze",
      payload: {
        imageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      },
    },
    {
      type: "cleanup",
      payload: {
        email: "person@example.com",
        imageUrl: "https://images.example.com/wardrobe/profile/image.webp",
        sourceBuffer: "normalized-webp",
        sourceFilename: "shirt.png",
        sourceKey: "wardrobe/profile/image.webp",
        sourceMimeType: "image/webp",
      },
    },
    {
      type: "updateMetadata",
      payload: {
        email: "person@example.com",
        id: "wardrobe-upload-1",
        imageUrl: "https://images.example.com/wardrobe/profile/image_clean.png",
        metadata,
        processingStatus: "ready",
      },
    },
  ]);
});

test("wardrobe upload route validates files and maps failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startTestServer(t);

  const empty = await requestMultipart(
    baseUrl,
    "/wardrobe/items/upload",
    new FormData(),
  );
  expect(empty.response.status).toBe(400);
  expect(empty.json).toEqual({ error: "invalid_payload" });

  const invalidMime = await requestMultipart(
    baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm([
      {
        bytes: Buffer.from("not an image"),
        name: "notes.txt",
        type: "text/plain",
      },
    ]),
  );
  expect(invalidMime.response.status).toBe(400);
  expect(invalidMime.json).toEqual({ error: "invalid_image" });

  const invalidBytes = await requestMultipart(
    baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm([
      {
        bytes: Buffer.from("not an image"),
        name: "fake.png",
        type: "image/png",
      },
    ]),
  );
  expect(invalidBytes.response.status).toBe(400);
  expect(invalidBytes.json).toEqual({ error: "invalid_image" });

  const tooMany = await requestMultipart(
    baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm(
      Array.from({ length: 6 }, (_value, index) => ({
        bytes: tinyPng,
        name: `shirt-${index}.png`,
        type: "image/png",
      })),
    ),
  );
  expect(tooMany.response.status).toBe(400);
  expect(tooMany.json).toEqual({ error: "too_many_files" });

  const failingServer = await startTestServer(t, {
    overrides: {
      normalizeWardrobeUploadImagesInChildImpl: async () => {
        throw new Error("child_down");
      },
    },
  });
  const serviceFailure = await requestMultipart(
    failingServer.baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm(),
  );
  expect(serviceFailure.response.status).toBe(200);
  expect(parseSseEvents(serviceFailure.text).at(-1)).toEqual({
    event: "fatal",
    data: { error: "service_unavailable" },
  });
});

test("wardrobe routes validate source and catalog item payloads", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const invalidSource = await requestJson(
    baseUrl,
    "/wardrobe/items?source=other",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(invalidSource.response.status).toBe(400);
  expect(invalidSource.json).toEqual({ error: "invalid_payload" });

  const invalidPdfSource = await requestJson(
    baseUrl,
    "/wardrobe/items/pdf?source=other",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(invalidPdfSource.response.status).toBe(400);
  expect(invalidPdfSource.json).toEqual({ error: "invalid_payload" });

  const invalidSave = await requestJson(
    baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "ftp://example.com/1" },
    },
  );
  expect(invalidSave.response.status).toBe(400);
  expect(invalidSave.json).toEqual({ error: "invalid_payload" });

  const invalidDelete = await requestJson(
    baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "ftp://example.com/1" },
    },
  );
  expect(invalidDelete.response.status).toBe(400);
  expect(invalidDelete.json).toEqual({ error: "invalid_payload" });
});

test("wardrobe routes map missing products and service failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const notFoundServer = await startTestServer(t, {
    overrides: {
      saveWardrobeItemFromCatalogImpl: async () => null,
    },
  });
  const notFound = await requestJson(
    notFoundServer.baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "https://example.com/missing" },
    },
  );
  expect(notFound.response.status).toBe(404);
  expect(notFound.json).toEqual({ error: "not_found" });

  const failingListServer = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async () => {
        throw new Error("wardrobe_down");
      },
    },
  });
  const listFailure = await requestJson(
    failingListServer.baseUrl,
    "/wardrobe/items",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(listFailure.response.status).toBe(503);
  expect(listFailure.json).toEqual({ error: "service_unavailable" });

  const failingDeleteServer = await startTestServer(t, {
    overrides: {
      deleteWardrobeItemFromCatalogImpl: async () => {
        throw new Error("wardrobe_down");
      },
    },
  });
  const deleteFailure = await requestJson(
    failingDeleteServer.baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "https://example.com/1" },
    },
  );
  expect(deleteFailure.response.status).toBe(503);
  expect(deleteFailure.json).toEqual({ error: "service_unavailable" });
});

test("wardrobe PDF route maps empty wardrobes and build failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const emptyServer = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async () => [],
    },
  });
  const emptyPdf = await requestJson(
    emptyServer.baseUrl,
    "/wardrobe/items/pdf",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(emptyPdf.response.status).toBe(404);
  expect(emptyPdf.json).toEqual({ error: "not_found" });

  const failingServer = await startTestServer(t, {
    overrides: {
      buildWardrobePdfInChildImpl: async () => {
        throw new Error("pdf_down");
      },
    },
  });
  const failingPdf = await requestJson(
    failingServer.baseUrl,
    "/wardrobe/items/pdf",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(failingPdf.response.status).toBe(503);
  expect(failingPdf.json).toEqual({ error: "service_unavailable" });
});
