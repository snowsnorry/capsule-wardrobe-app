import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";
import { encodeWardrobePageCursor } from "../db.js";
import { buildPersonalItemsReportDedupeKey } from "./personalItemsReportRoutes.js";

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

async function requestUploadUrls(baseUrl, urls) {
  const response = await fetch(`${baseUrl}/wardrobe/items/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: AUTH_COOKIE,
      "X-CSRF-Token": CSRF_TOKEN,
      origin: TEST_CLIENT_ORIGIN,
    },
    body: JSON.stringify({ urls }),
  });
  const text = await response.text();
  return {
    response,
    json: text && text.startsWith("{") ? JSON.parse(text) : null,
    text,
  };
}

async function requestReportStream(baseUrl, body = {}) {
  const response = await fetch(`${baseUrl}/wardrobe/items/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: AUTH_COOKIE,
      "X-CSRF-Token": CSRF_TOKEN,
      origin: TEST_CLIENT_ORIGIN,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    json: text && text.startsWith("{") ? JSON.parse(text) : null,
    text,
  };
}

function expectQueuedJob(
  result,
  kind,
  entity = { type: "wardrobe", id: null },
) {
  const json = result.json || JSON.parse(result.text || "{}");
  expect(result.response.status).toBe(202);
  expect(json).toMatchObject({
    ok: true,
    job: {
      kind,
      status: "queued",
      entity,
    },
  });
  expect(typeof json.job.id).toBe("string");
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

test("personal items report dedupe key hashes context into a bounded value", () => {
  const rawContext = `office ${"very-sensitive-context ".repeat(200)}`;
  const dedupeKey = buildPersonalItemsReportDedupeKey(rawContext);

  expect(dedupeKey).toMatch(/^personalItemsReport:v1:[a-f0-9]{64}$/);
  expect(dedupeKey).toHaveLength("personalItemsReport:v1:".length + 64);
  expect(dedupeKey).not.toContain("very-sensitive-context");
});

test("personal items report dedupe key treats blank context as missing", () => {
  expect(buildPersonalItemsReportDedupeKey("   \n\t")).toBe(
    buildPersonalItemsReportDedupeKey(null),
  );
});

test("wardrobe routes list and save user wardrobe items", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listWardrobeItemsPageImpl: async (payload) => {
        calls.push({ type: "listPage", payload });
        return {
          items: [
            {
              createdAt: "2026-05-01T00:00:00.000Z",
              email: "person@example.com",
              embedding: [0.1, 0.2],
              id: "wardrobe-1",
              productId: "product-1",
              profileEmail: "person@example.com",
              rawImageUrl: "https://example.com/raw.jpg",
              url: "https://example.com/1",
              source: "from_catalog",
              updatedAt: "2026-05-01T00:00:00.000Z",
            },
          ],
          pagination: {
            hasMore: false,
            limit: payload.limit,
            nextCursor: null,
          },
        };
      },
      listWardrobeItemsImpl: async () => [
        {
          createdAt: "2026-05-01T00:00:00.000Z",
          email: "person@example.com",
          embedding: [0.1, 0.2],
          id: "wardrobe-1",
          productId: "product-1",
          profileEmail: "person@example.com",
          rawImageUrl: "https://example.com/raw.jpg",
          url: "https://example.com/1",
          source: "from_catalog",
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      saveWardrobeItemFromCatalogImpl: async (payload) => {
        calls.push({ type: "save", payload });
        return {
          createdAt: "2026-05-01T00:00:00.000Z",
          id: "wardrobe-1",
          productId: "product-1",
          profileEmail: "person@example.com",
          url: payload.url,
          source: "from_catalog",
          updatedAt: "2026-05-01T00:00:00.000Z",
        };
      },
      listLikedItemUrlsForUrlsImpl: async (payload) => {
        calls.push({ type: "likedScoped", payload });
        return ["https://example.com/1"];
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
    pagination: {
      hasMore: false,
      limit: 48,
      nextCursor: null,
    },
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
      isLiked: true,
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
      type: "listPage",
      payload: {
        cursor: null,
        email: "person@example.com",
        likedOnly: false,
        limit: 48,
        source: "from_catalog",
      },
    },
    {
      type: "save",
      payload: { email: "person@example.com", url: "https://example.com/1" },
    },
    {
      type: "likedScoped",
      payload: {
        email: "person@example.com",
        itemUrls: ["https://example.com/1"],
      },
    },
    {
      type: "delete",
      payload: { email: "person@example.com", url: "https://example.com/1" },
    },
  ]);
});

test("wardrobe list legacy fallback scopes liked lookup to the returned page", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listLikedItemUrlsImpl: async () => {
        throw new Error("liked_urls_should_not_be_loaded");
      },
      listLikedItemUrlsForUrlsImpl: async (payload) => {
        calls.push({ type: "likedScoped", payload });
        return ["https://example.com/1"];
      },
      listWardrobeItemsImpl: async () => [
        {
          id: "wardrobe-1",
          source: "from_catalog",
          url: "https://example.com/1",
        },
        {
          id: "wardrobe-2",
          source: "from_catalog",
          url: "https://example.com/2",
        },
      ],
      listWardrobeItemsPageImpl: undefined,
    },
  });

  const list = await requestJson(
    baseUrl,
    "/wardrobe/items?source=from_catalog&limit=1",
    { cookie: AUTH_COOKIE },
  );

  expect(list.response.status).toBe(200);
  expect(list.json).toEqual({
    ok: true,
    items: [
      {
        id: "wardrobe-1",
        source: "from_catalog",
        url: "https://example.com/1",
        isLiked: true,
      },
    ],
    pagination: {
      hasMore: false,
      limit: 1,
      nextCursor: null,
    },
  });
  expect(calls).toEqual([
    {
      type: "likedScoped",
      payload: {
        email: "person@example.com",
        itemUrls: ["https://example.com/1"],
      },
    },
  ]);
});

test("wardrobe list route supports cursor pagination and liked filtering", async (t) => {
  const cursor = encodeWardrobePageCursor({
    createdAt: "2026-05-01T00:00:00.000Z",
    id: "42",
    updatedAt: "2026-05-02T00:00:00.000Z",
  });
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listLikedItemUrlsImpl: async () => {
        throw new Error("liked_urls_should_not_be_loaded");
      },
      listWardrobeItemsPageImpl: async (payload) => {
        calls.push(payload);
        return {
          items: [
            {
              createdAt: "2026-05-01T00:00:00.000Z",
              embedding: [0.1],
              id: "44",
              profileEmail: "person@example.com",
              rawImageUrl: "https://example.com/raw.jpg",
              source: "from_catalog",
              updatedAt: "2026-05-02T00:00:00.000Z",
              url: "https://example.com/liked",
              isLiked: true,
            },
          ],
          pagination: {
            hasMore: true,
            limit: 24,
            nextCursor: "next-cursor",
          },
        };
      },
    },
  });

  const list = await requestJson(
    baseUrl,
    `/wardrobe/items?source=from_catalog&likedOnly=true&limit=24&cursor=${cursor}`,
    { cookie: AUTH_COOKIE },
  );

  expect(list.response.status).toBe(200);
  expect(list.json).toEqual({
    ok: true,
    items: [
      {
        id: "44",
        source: "from_catalog",
        url: "https://example.com/liked",
        isLiked: true,
      },
    ],
    pagination: {
      hasMore: true,
      limit: 24,
      nextCursor: "next-cursor",
    },
  });
  expect(calls).toEqual([
    {
      cursor,
      email: "person@example.com",
      likedOnly: true,
      limit: 24,
      source: "from_catalog",
    },
  ]);
});

test("personal items report routes read stale state generate and delete reports", async (t) => {
  const calls: unknown[] = [];
  const storedReport = {
    email: "person@example.com",
    generatedAt: "2026-06-19T10:00:00.000Z",
    personalItemUrls: ["wardrobe://1"],
    report: {
      schemaVersion: 1,
      verdict: { status: "good", score: 0.8, summary: "Usable." },
    },
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      deletePersonalItemsReportImpl: async (email) => {
        calls.push({ type: "deleteReport", payload: email });
        return true;
      },
      generatePersonalItemsReportImpl: async (email, context) => {
        calls.push({ type: "generateReport", payload: { email, context } });
        return {
          generatedAt: "2026-06-19T11:00:00.000Z",
          personalItemUrls: ["https://example.com/2", "wardrobe://1"],
          report: {
            schemaVersion: 1,
            verdict: { status: "excellent", score: 0.92, summary: "Ready." },
          },
        };
      },
      getPersonalItemsReportImpl: async (email) => {
        calls.push({ type: "getReport", payload: email });
        return storedReport;
      },
      listWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "listItems", payload });
        return [
          { id: "1", url: "wardrobe://1", source: "uploaded" },
          {
            id: "2",
            url: "https://example.com/2",
            source: "from_catalog",
          },
        ];
      },
    },
  });

  const fetched = await requestJson(baseUrl, "/wardrobe/items/report", {
    cookie: AUTH_COOKIE,
  });
  expect(fetched.response.status).toBe(200);
  expect(fetched.json).toEqual({
    ok: true,
    report: storedReport.report,
    personalItemUrls: ["wardrobe://1"],
    generatedAt: "2026-06-19T10:00:00.000Z",
    stale: true,
  });

  const missingCsrf = await requestJson(baseUrl, "/wardrobe/items/report", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    body: { context: "office" },
  });
  expect(missingCsrf.response.status).toBe(403);

  const generated = await requestReportStream(baseUrl, { context: "office" });
  expectQueuedJob(generated, "personalItemsReportGenerate");

  const deleted = await requestJson(baseUrl, "/wardrobe/items/report", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true, removed: true });
  expect(calls).not.toContainEqual(
    expect.objectContaining({ type: "generateReport" }),
  );
  expect(calls).toContainEqual({
    type: "deleteReport",
    payload: "person@example.com",
  });
});

test("personal items report route returns current URL snapshot when no report exists", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getPersonalItemsReportImpl: async () => null,
      listWardrobeItemsImpl: async () => [
        { id: "1", url: " wardrobe://2 ", source: "uploaded" },
        { id: "2", url: "https://example.com/1", source: "from_catalog" },
        { id: "3", url: "wardrobe://2", source: "uploaded" },
        { id: "4", url: "", source: "uploaded" },
      ],
    },
  });

  const fetched = await requestJson(baseUrl, "/wardrobe/items/report", {
    cookie: AUTH_COOKIE,
  });
  expect(fetched.response.status).toBe(200);
  expect(fetched.json).toEqual({
    ok: true,
    report: null,
    personalItemUrls: ["https://example.com/1", "wardrobe://2"],
    generatedAt: null,
    stale: false,
  });
});

test("personal items report route validates payloads before enqueue", async (t) => {
  const generatePersonalItemsReportImpl = vi.fn();
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      generatePersonalItemsReportImpl,
    },
  });

  await expect(
    requestReportStream(baseUrl, { context: 42 }),
  ).resolves.toMatchObject({
    response: { status: 400 },
    text: JSON.stringify({ error: "invalid_payload" }),
  });

  const invalid = await requestReportStream(baseUrl, {
    context: "bad payload",
  });
  expectQueuedJob(invalid, "personalItemsReportGenerate");
  expect(generatePersonalItemsReportImpl).not.toHaveBeenCalled();
});

test("personal items report route enqueues with hashed dedupe key and raw context payload", async (t) => {
  const enqueuedJobs: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      enqueueJobImpl: async (input) => {
        enqueuedJobs.push(input);
        return {
          completedAt: null,
          createdAt: "2026-06-19T10:00:00.000Z",
          entity: input.entity || null,
          error: null,
          failedAt: null,
          id: "job-personal-report",
          kind: input.kind,
          phase: input.phase || null,
          progress: {
            current: 0,
            label: input.progressLabel || null,
            total: input.progressTotal ?? null,
          },
          result: null,
          startedAt: null,
          status: "queued",
          updatedAt: "2026-06-19T10:00:00.000Z",
        };
      },
    },
  });
  const context = `office ${"very-sensitive-context ".repeat(100)}`;

  const generated = await requestReportStream(baseUrl, { context });

  expectQueuedJob(generated, "personalItemsReportGenerate");
  expect(enqueuedJobs).toHaveLength(1);
  expect(enqueuedJobs[0]).toMatchObject({
    dedupeKey: buildPersonalItemsReportDedupeKey(context),
    payload: { context },
  });
  expect(
    String((enqueuedJobs[0] as { dedupeKey?: unknown }).dedupeKey),
  ).not.toContain("very-sensitive-context");
});

test("personal items report routes return service unavailable for read and delete failures", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      deletePersonalItemsReportImpl: async () => {
        throw new Error("delete failed");
      },
      getPersonalItemsReportImpl: async () => {
        throw new Error("read failed");
      },
    },
  });

  const fetched = await requestJson(baseUrl, "/wardrobe/items/report", {
    cookie: AUTH_COOKIE,
  });
  expect(fetched.response.status).toBe(503);
  expect(fetched.json).toEqual({ error: "service_unavailable" });

  const deleted = await requestJson(baseUrl, "/wardrobe/items/report", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(503);
  expect(deleted.json).toEqual({ error: "service_unavailable" });
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
          processingStatus: payload.processingStatus,
          updatedAt: "2026-05-01T00:00:00.000Z",
          ...payload.details,
        };
      },
      createUploadedWardrobeItemEmbeddingImpl: async (details) => {
        calls.push({ type: "embed", details });
        return [0.4, 0.5];
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
        formalityLevel: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        colorBase: ["white"],
        pattern: "solid",
        finish: null,
        composition: ["linen", "cotton"],
        silhouette: null,
        fit: "regular",
        closureType: ["button"],
      },
    },
  );

  expect(update.response.status).toBe(200);
  expect(update.json).toEqual({
    ok: true,
    item: {
      id: "uploaded-1",
      source: "uploaded",
      processingStatus: "ready",
      name: "Updated shirt",
      description: "Button-front shirt",
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: ["casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      colorBase: ["white"],
      pattern: "solid",
      finish: null,
      composition: "linen, cotton",
      silhouette: null,
      fit: "regular",
      closureType: ["button"],
    },
  });
  expect(calls).toEqual([
    {
      type: "embed",
      details: {
        name: "Updated shirt",
        description: "Button-front shirt",
        brand: null,
        audience: "all",
        category: "top",
        season: ["summer"],
        formalityLevel: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        colorBase: ["white"],
        pattern: "solid",
        finish: null,
        composition: "linen, cotton",
        silhouette: null,
        fit: "regular",
        closureType: ["button"],
      },
    },
    {
      embedding: [0.4, 0.5],
      email: "person@example.com",
      id: "uploaded-1",
      details: {
        name: "Updated shirt",
        description: "Button-front shirt",
        brand: null,
        audience: "all",
        category: "top",
        season: ["summer"],
        formalityLevel: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        colorBase: ["white"],
        pattern: "solid",
        finish: null,
        composition: "linen, cotton",
        silhouette: null,
        fit: "regular",
        closureType: ["button"],
      },
      processingStatus: "ready",
    },
  ]);
});

test("wardrobe routes fetch uploaded item details for the authenticated user", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getUploadedWardrobeItemImpl: async (payload) => {
        calls.push(payload);
        if (payload.id === "missing") {
          return null;
        }

        return {
          id: payload.id,
          profileEmail: payload.email,
          email: payload.email,
          productId: "private-product",
          name: "Uploaded shirt",
          url: `wardrobe://${payload.id}`,
          source: "uploaded",
          imageUrl: "https://example.com/uploaded.jpg",
          rawImageUrl: "https://example.com/uploaded-original.jpg",
          processingStatus: "ready",
          audience: "all",
          category: "top",
          season: ["summer"],
          updatedAt: "2026-05-01T00:00:00.000Z",
        };
      },
    },
  });

  const detail = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/uploaded-1",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(detail.response.status).toBe(200);
  expect(detail.json).toEqual({
    ok: true,
    item: {
      id: "uploaded-1",
      name: "Uploaded shirt",
      url: "wardrobe://uploaded-1",
      source: "uploaded",
      isLiked: false,
      imageUrl: "https://example.com/uploaded.jpg",
      rawImageUrl: "https://example.com/uploaded-original.jpg",
      processingStatus: "ready",
      audience: "all",
      category: "top",
      season: ["summer"],
    },
  });

  const missing = await requestJson(
    baseUrl,
    "/wardrobe/items/uploaded/missing",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(missing.response.status).toBe(404);
  expect(missing.json).toEqual({ error: "not_found" });
  expect(calls).toEqual([
    { email: "person@example.com", id: "uploaded-1" },
    { email: "person@example.com", id: "missing" },
  ]);
});

test("wardrobe uploaded item updates save failed status when embedding fails", async (t) => {
  const calls: unknown[] = [];
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      createUploadedWardrobeItemEmbeddingImpl: async (details) => {
        calls.push({ type: "embed", details });
        throw new Error("voyage_down");
      },
      updateUploadedWardrobeItemDetailsImpl: async (payload) => {
        calls.push({ type: "update", payload });
        return {
          id: payload.id,
          source: "uploaded",
          processingStatus: payload.processingStatus,
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
        audience: "unisex",
        category: "top",
        season: ["summer"],
      },
    },
  );

  expect(update.response.status).toBe(200);
  expect(update.json).toEqual({
    ok: true,
    item: expect.objectContaining({
      id: "uploaded-1",
      source: "uploaded",
      processingStatus: "failed",
      name: "Updated shirt",
    }),
  });
  expect(calls).toEqual([
    {
      type: "embed",
      details: expect.objectContaining({
        name: "Updated shirt",
        audience: "all",
        category: "top",
      }),
    },
    {
      type: "update",
      payload: expect.objectContaining({
        embedding: null,
        email: "person@example.com",
        id: "uploaded-1",
        processingStatus: "failed",
      }),
    },
  ]);
  consoleError.mockRestore();
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
          imageUrl: "https://attacker.example.com/wardrobe/other/image.png",
          ownedR2ImageKeys: [
            "wardrobe/542d240129883c01/image.webp",
            "wardrobe/542d240129883c01/image_clean.png",
            "wardrobe/542d240129883c01/image_clean_320.webp",
            "wardrobe/542d240129883c01/image_clean_480.webp",
            "wardrobe/542d240129883c01/image_clean_640.webp",
          ],
          rawImageUrl: "https://attacker.example.com/wardrobe/other/raw.png",
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
          "wardrobe/542d240129883c01/image.webp",
          "wardrobe/542d240129883c01/image_clean.png",
          "wardrobe/542d240129883c01/image_clean_320.webp",
          "wardrobe/542d240129883c01/image_clean_480.webp",
          "wardrobe/542d240129883c01/image_clean_640.webp",
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
          "wardrobe/542d240129883c01/image.webp",
          "wardrobe/542d240129883c01/image_clean.png",
          "wardrobe/542d240129883c01/image_clean_320.webp",
          "wardrobe/542d240129883c01/image_clean_480.webp",
          "wardrobe/542d240129883c01/image_clean_640.webp",
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
  let pdfOptions: unknown;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "list", payload });
        return [
          {
            id: "wardrobe-1",
            name: "Saved shirt",
            imageUrl: "https://example.com/1.jpg",
            formalityLevel: "casual",
            colorBase: ["white"],
            isNeutral: true,
            closureType: "buttons",
            url: "https://example.com/1",
            source: "uploaded",
          },
        ];
      },
      buildWardrobePdfInChildImpl: async (items, locale, options) => {
        pdfItems = items;
        pdfLocale = locale;
        pdfOptions = options;
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
    `attachment; filename="Personal-items.pdf"; filename*=UTF-8''${encodeURIComponent("Personal items.pdf")}`,
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
  expect(pdfOptions).toBeUndefined();
  expect(calls).toEqual([
    {
      type: "list",
      payload: { email: "person@example.com", source: "uploaded" },
    },
  ]);
});

test("wardrobe routes include current personal items report in full PDF export", async (t) => {
  let pdfOptions: unknown;
  const report = {
    schemaVersion: 1,
    verdict: { status: "good", score: 0.82, summary: "Ready." },
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getPersonalItemsReportImpl: async () => ({
        email: "person@example.com",
        generatedAt: "2026-06-19T10:00:00.000Z",
        personalItemUrls: ["wardrobe://1"],
        report,
      }),
      listWardrobeItemsImpl: async () => [
        { id: "1", url: "wardrobe://1", source: "uploaded" },
        { id: "2", url: "https://example.com/2", source: "from_catalog" },
      ],
      buildWardrobePdfInChildImpl: async (_items, _locale, options) => {
        pdfOptions = options;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(baseUrl, "/wardrobe/items/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });

  expect(pdf.response.status).toBe(200);
  expect(pdfOptions).toEqual({
    personalItems: {
      report,
      reportStale: true,
    },
  });
});

test("wardrobe routes mark matching personal items PDF reports fresh", async (t) => {
  let pdfOptions: unknown;
  const report = {
    schemaVersion: 1,
    verdict: { status: "good", score: 0.82, summary: "Ready." },
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getPersonalItemsReportImpl: async () => ({
        email: "person@example.com",
        generatedAt: "2026-06-19T10:00:00.000Z",
        personalItemUrls: ["https://example.com/2", "wardrobe://1"],
        report,
      }),
      listWardrobeItemsImpl: async () => [
        { id: "1", url: "wardrobe://1", source: "uploaded" },
        { id: "2", url: "https://example.com/2", source: "from_catalog" },
      ],
      buildWardrobePdfInChildImpl: async (_items, _locale, options) => {
        pdfOptions = options;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(baseUrl, "/wardrobe/items/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });

  expect(pdf.response.status).toBe(200);
  expect(pdfOptions).toEqual({
    personalItems: {
      report,
      reportStale: false,
    },
  });
});

test("wardrobe routes omit personal items PDF options when no report exists", async (t) => {
  let pdfOptions: unknown;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getPersonalItemsReportImpl: async () => null,
      listWardrobeItemsImpl: async () => [
        { id: "1", url: "wardrobe://1", source: "uploaded" },
      ],
      buildWardrobePdfInChildImpl: async (_items, _locale, options) => {
        pdfOptions = options;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(baseUrl, "/wardrobe/items/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });

  expect(pdf.response.status).toBe(200);
  expect(pdfOptions).toBeUndefined();
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
    formalityLevel: ["smart_casual"],
    style: [],
    occasions: [],
    colorBase: ["white"],
    isNeutral: true,
    pattern: "solid",
    finish: null,
    composition: "linen",
    silhouette: null,
    fit: "regular",
    closureType: ["button"],
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadFilesInChildImpl: async (payload) => {
        calls.push({
          type: "processFiles",
          files: payload.files.map((file) => ({
            hasFilePath: Boolean(file.filePath),
            mimeType: file.mimeType,
            originalName: file.originalName,
          })),
          imageLlm: payload.imageLlm,
        });
        const source = {
          imageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/image.webp",
          kind: "file",
          productPageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/image.webp",
          rawImageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/image.webp",
          sourceImageKey: "wardrobe/542d240129883c01/image.webp",
          sourceImageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/image.webp",
        };
        payload.onEvent?.({
          event: "source-uploaded",
          inputIndex: 0,
          kind: "file",
          source,
          type: "event",
        });
        return [
          {
            analysis: {
              hasMetadata: true,
              metadata,
              rawResponse: JSON.stringify(metadata),
            },
            cleanup: {
              cleanImage: {
                key: "wardrobe/542d240129883c01/image_clean.png",
                url: "https://images.example.com/wardrobe/542d240129883c01/image_clean.png",
                digest: "clean-digest",
              },
              thumbnails: [],
            },
            inputIndex: 0,
            ok: true,
            source,
          },
        ];
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", payload });
        return [
          {
            id: "wardrobe-upload-1",
            profileEmail: "person@example.com",
            imageUrl: payload.items[0].imageUrl,
            rawImageUrl: payload.items[0].rawImageUrl,
            source: "uploaded",
            processingStatus: "uploaded",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      createUploadedWardrobeItemEmbeddingImpl: async (item) => {
        calls.push({ type: "embed", item });
        return [0.7, 0.8];
      },
      updateUploadedWardrobeItemMetadataImpl: async (payload) => {
        calls.push({ type: "updateMetadata", payload });
        return {
          id: payload.id,
          imageUrl: payload.imageUrl,
          rawImageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/image.webp",
          source: "uploaded",
          processingStatus: payload.processingStatus,
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

  expectQueuedJob(upload, "personalItemUploadFiles");
  expect(calls).toEqual([]);
});

test("wardrobe URL upload route imports image URLs from worker results", async (t) => {
  const calls: unknown[] = [];
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: "Shop Brand",
    audience: "women",
    category: "top",
    season: ["summer"],
    formalityLevel: ["smart_casual"],
    style: [],
    occasions: [],
    colorBase: ["white"],
    isNeutral: true,
    pattern: "solid",
    finish: null,
    composition: "linen",
    silhouette: null,
    fit: "regular",
    closureType: ["button"],
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: async (payload) => {
        calls.push({
          type: "processUrls",
          imageLlm: payload.imageLlm,
          urls: payload.urls,
        });
        const source = {
          imageUrl: "https://shop.example.com/images/linen.jpg",
          kind: "direct-image",
          productPageUrl: "https://shop.example.com/images/linen.jpg",
          rawImageUrl: "https://shop.example.com/images/linen.jpg",
          sourceImageKey: "wardrobe/542d240129883c01/remote-source.webp",
          sourceImageUrl: "https://shop.example.com/images/linen.jpg",
        };
        payload.onEvent?.({
          event: "source-uploaded",
          inputIndex: 0,
          kind: "direct-image",
          source,
          type: "event",
        });
        return [
          {
            analysis: {
              hasMetadata: true,
              metadata,
              rawResponse: JSON.stringify(metadata),
            },
            cleanup: {
              cleanImage: {
                key: "wardrobe/542d240129883c01/remote-source_clean.png",
                url: "https://images.example.com/wardrobe/542d240129883c01/remote-source_clean.png",
                digest: "clean-digest",
              },
              thumbnails: [],
            },
            inputIndex: 0,
            ok: true,
            source,
          },
        ];
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", payload });
        return [
          {
            id: "wardrobe-url-upload-1",
            profileEmail: "person@example.com",
            url: payload.items[0].url,
            imageUrl: payload.items[0].imageUrl,
            rawImageUrl: payload.items[0].rawImageUrl,
            source: "uploaded",
            processingStatus: "uploaded",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      createUploadedWardrobeItemEmbeddingImpl: async (item) => {
        calls.push({ type: "embed", item });
        return [0.7, 0.8];
      },
      updateUploadedWardrobeItemMetadataImpl: async (payload) => {
        calls.push({ type: "updateMetadata", payload });
        return {
          id: payload.id,
          url: "https://shop.example.com/images/linen.jpg",
          imageUrl: payload.imageUrl,
          rawImageUrl: "https://shop.example.com/images/linen.jpg",
          source: "uploaded",
          processingStatus: payload.processingStatus,
          ...payload.metadata,
        };
      },
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/images/linen.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(calls).toEqual([]);
});

test("wardrobe URL upload route imports direct image URLs without cleanup generation", async (t) => {
  const calls: Array<{
    type: string;
    key?: string;
    [key: string]: unknown;
  }> = [];
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: null,
    audience: "all",
    category: "top",
    season: ["summer"],
    formalityLevel: ["casual"],
    style: [],
    occasions: [],
    colorBase: ["white"],
    isNeutral: true,
    pattern: "solid",
    finish: null,
    composition: "linen",
    silhouette: null,
    fit: "regular",
    closureType: ["button"],
  };
  const cleanup = vi.fn(async () => {
    throw new Error("should_not_cleanup_direct_image");
  });
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: async (payload) => {
        calls.push({
          type: "processUrls",
          imageLlm: payload.imageLlm,
          urls: payload.urls,
        });
        const source = {
          imageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/direct-image.webp",
          kind: "direct-image",
          productPageUrl: "https://cdn.example.com/products/linen-shirt.jpg",
          rawImageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/direct-image.webp",
          sourceImageKey: "wardrobe/542d240129883c01/direct-image.webp",
          sourceImageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/direct-image.webp",
        };
        payload.onEvent?.({
          event: "source-uploaded",
          inputIndex: 0,
          kind: "direct-image",
          source,
          type: "event",
        });
        return [
          {
            analysis: {
              hasMetadata: true,
              metadata,
              rawResponse: JSON.stringify(metadata),
            },
            cleanup: {
              cleanImage: {
                key: "wardrobe/542d240129883c01/direct-image.webp",
                url: "https://images.example.com/wardrobe/542d240129883c01/direct-image.webp",
                digest: "direct-digest",
              },
              thumbnails: [
                {
                  key: "wardrobe/542d240129883c01/direct-image_320.webp",
                  url: "https://images.example.com/wardrobe/542d240129883c01/direct-image_320.webp",
                  digest: "thumb-320",
                  width: 320,
                },
                {
                  key: "wardrobe/542d240129883c01/direct-image_480.webp",
                  url: "https://images.example.com/wardrobe/542d240129883c01/direct-image_480.webp",
                  digest: "thumb-480",
                  width: 480,
                },
                {
                  key: "wardrobe/542d240129883c01/direct-image_640.webp",
                  url: "https://images.example.com/wardrobe/542d240129883c01/direct-image_640.webp",
                  digest: "thumb-640",
                  width: 640,
                },
              ],
            },
            inputIndex: 0,
            ok: true,
            source,
          },
        ];
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", payload });
        return [
          {
            id: "wardrobe-direct-image-1",
            profileEmail: "person@example.com",
            url: payload.items[0].url,
            imageUrl: payload.items[0].imageUrl,
            rawImageUrl: payload.items[0].rawImageUrl,
            source: "uploaded",
            processingStatus: "uploaded",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      cleanupUploadedWardrobeItemImageImpl: cleanup,
      createUploadedWardrobeItemEmbeddingImpl: async (item) => {
        calls.push({ type: "embed", item });
        return [0.7, 0.8];
      },
      updateUploadedWardrobeItemMetadataImpl: async (payload) => {
        calls.push({ type: "updateMetadata", payload });
        return {
          id: payload.id,
          url: "https://cdn.example.com/products/linen-shirt.jpg",
          imageUrl: payload.imageUrl,
          rawImageUrl:
            "https://images.example.com/wardrobe/542d240129883c01/direct-image.webp",
          source: "uploaded",
          processingStatus: payload.processingStatus,
          ...payload.metadata,
        };
      },
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://cdn.example.com/products/linen-shirt.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(cleanup).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
});

test("wardrobe URL upload route enqueues jobs before URL classification", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const processUrls = vi.fn(async () => []);
  const saveUploaded = vi.fn(async () => {
    throw new Error("should_not_save_non_image_url");
  });
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: processUrls,
      saveUploadedWardrobeItemsImpl: saveUploaded,
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/products/not-an-image",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(processUrls).not.toHaveBeenCalled();
  expect(saveUploaded).not.toHaveBeenCalled();
});

test("wardrobe URL upload route enqueues jobs before image fetching", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const processUrls = vi.fn(async () => []);
  const saveUploaded = vi.fn(async () => {
    throw new Error("should_not_save_without_downloaded_image_url");
  });
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: processUrls,
      saveUploadedWardrobeItemsImpl: saveUploaded,
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/products/missing-image-file.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(processUrls).not.toHaveBeenCalled();
  expect(saveUploaded).not.toHaveBeenCalled();
});

test("wardrobe URL upload route enqueues jobs before persistence work", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const processUrls = vi.fn(async () => []);
  const saveUploaded = vi.fn(async () => []);
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: processUrls,
      saveUploadedWardrobeItemsImpl: saveUploaded,
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/image.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(processUrls).not.toHaveBeenCalled();
  expect(saveUploaded).not.toHaveBeenCalled();
});

test("wardrobe URL upload route enqueues jobs without running workers inline", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const processUrls = vi.fn(async () => {
    throw new Error("worker_down");
  });
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: processUrls,
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/image.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(processUrls).not.toHaveBeenCalled();
});

test("wardrobe URL upload route leaves worker cleanup to the queued handler", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: async () => {
        throw new Error("worker_down_after_source");
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", payload });
        return [
          {
            id: "wardrobe-url-orphan",
            profileEmail: "person@example.com",
            url: payload.items[0].url,
            imageUrl: payload.items[0].imageUrl,
            rawImageUrl: payload.items[0].rawImageUrl,
            source: "uploaded",
            processingStatus: "uploaded",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      updateUploadedWardrobeItemMetadataImpl: async (payload) => {
        calls.push({ type: "updateMetadata", payload });
        return {
          id: payload.id,
          processingStatus: payload.processingStatus,
        };
      },
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/images/linen.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(calls).toEqual([]);
});

test("wardrobe URL upload route enqueues multi-url jobs", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const calls: unknown[] = [];
  const metadata = {
    name: "Cotton tee",
    description: null,
    brand: "Shop Brand",
    audience: "men",
    category: "top",
    season: ["summer"],
    formalityLevel: ["casual"],
    style: [],
    occasions: [],
    colorBase: ["blue"],
    isNeutral: false,
    pattern: "solid",
    finish: null,
    composition: "cotton",
    silhouette: null,
    fit: "regular",
    closureType: [],
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: async (payload) => {
        calls.push({ type: "processUrls", urls: payload.urls });
        return [
          {
            inputIndex: 0,
            message: "image_url_invalid",
            ok: false,
            source: null,
          },
          {
            analysis: {
              hasMetadata: true,
              metadata,
              rawResponse: JSON.stringify(metadata),
            },
            cleanup: {
              cleanImage: {
                key: "wardrobe/542d240129883c01/tee-source_clean.png",
                url: "https://images.example.com/wardrobe/542d240129883c01/tee-source_clean.png",
                digest: "clean-digest",
              },
              thumbnails: [],
            },
            inputIndex: 1,
            ok: true,
            source: {
              imageUrl: "https://shop.example.com/tee.jpg",
              kind: "direct-image",
              productPageUrl: "https://shop.example.com/tee.jpg",
              rawImageUrl: "https://shop.example.com/tee.jpg",
              sourceImageKey: "wardrobe/542d240129883c01/tee-source.webp",
              sourceImageUrl: "https://shop.example.com/tee.jpg",
            },
          },
        ];
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", items: payload.items });
        return [
          {
            id: "wardrobe-url-upload-tee",
            profileEmail: "person@example.com",
            url: payload.items[0].url,
            imageUrl: payload.items[0].imageUrl,
            rawImageUrl: payload.items[0].rawImageUrl,
            source: "uploaded",
            processingStatus: "uploaded",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      createUploadedWardrobeItemEmbeddingImpl: async () => [0.2, 0.3],
      updateUploadedWardrobeItemMetadataImpl: async (payload) => ({
        id: payload.id,
        url: "https://shop.example.com/tee.jpg",
        imageUrl: payload.imageUrl,
        rawImageUrl: "https://shop.example.com/tee.jpg",
        source: "uploaded",
        processingStatus: payload.processingStatus,
        ...payload.metadata,
      }),
    },
  });

  const upload = await requestUploadUrls(baseUrl, [
    "https://shop.example.com/missing-image.jpg",
    "https://shop.example.com/tee.jpg",
  ]);

  expectQueuedJob(upload, "personalItemUploadUrls");
  expect(calls).toEqual([]);
});

test("wardrobe URL upload route responds before worker execution", async (t) => {
  let workerStarted = false;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadUrlsInChildImpl: async () => {
        workerStarted = true;
        return new Promise(() => {});
      },
    },
  });
  const abortController = new AbortController();
  const response = await fetch(`${baseUrl}/wardrobe/items/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: AUTH_COOKIE,
      "X-CSRF-Token": CSRF_TOKEN,
      origin: TEST_CLIENT_ORIGIN,
    },
    body: JSON.stringify({
      urls: ["https://shop.example.com/products/slow"],
    }),
    signal: abortController.signal,
  });
  const text = await response.text();
  expectQueuedJob(
    {
      response,
      json: JSON.parse(text),
      text,
    },
    "personalItemUploadUrls",
  );
  abortController.abort();

  expect(workerStarted).toBe(false);
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
      processWardrobeUploadFilesInChildImpl: async () => {
        throw new Error("child_down");
      },
    },
  });
  const serviceFailure = await requestMultipart(
    failingServer.baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm(),
  );
  expectQueuedJob(serviceFailure, "personalItemUploadFiles");
});

test("wardrobe file upload route leaves worker cleanup to the queued handler", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      processWardrobeUploadFilesInChildImpl: async () => {
        throw new Error("worker_down_after_source");
      },
      saveUploadedWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "saveUploaded", payload });
        return [
          {
            id: "wardrobe-file-orphan",
            profileEmail: "person@example.com",
            imageUrl: payload.items[0].imageUrl,
            rawImageUrl: payload.items[0].rawImageUrl,
            source: "uploaded",
            processingStatus: "uploaded",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ];
      },
      updateUploadedWardrobeItemMetadataImpl: async (payload) => {
        calls.push({ type: "updateMetadata", payload });
        return {
          id: payload.id,
          processingStatus: payload.processingStatus,
        };
      },
    },
  });

  const upload = await requestMultipart(
    baseUrl,
    "/wardrobe/items/upload",
    buildUploadForm([{ bytes: tinyPng, name: "shirt.png", type: "image/png" }]),
  );

  expectQueuedJob(upload, "personalItemUploadFiles");
  expect(calls).toEqual([]);
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

  for (const path of [
    "/wardrobe/items?cursor=not-a-cursor",
    "/wardrobe/items?limit=0",
    "/wardrobe/items?limit=24abc",
    "/wardrobe/items?limit=24.9",
    "/wardrobe/items?likedOnly=yes",
  ]) {
    const invalidPagination = await requestJson(baseUrl, path, {
      cookie: AUTH_COOKIE,
    });
    expect(invalidPagination.response.status).toBe(400);
    expect(invalidPagination.json).toEqual({ error: "invalid_payload" });
  }

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

  for (const urls of [
    [],
    ["ftp://shop.example.com/product"],
    ["http://127.0.0.1/product"],
    [
      "https://shop.example.com/1",
      "https://shop.example.com/2",
      "https://shop.example.com/3",
      "https://shop.example.com/4",
      "https://shop.example.com/5",
      "https://shop.example.com/6",
    ],
  ]) {
    const invalidUrlUpload = await requestJson(
      baseUrl,
      "/wardrobe/items/upload-url",
      {
        method: "POST",
        origin: TEST_CLIENT_ORIGIN,
        cookie: AUTH_COOKIE,
        csrfToken: CSRF_TOKEN,
        body: { urls },
      },
    );
    expect(invalidUrlUpload.response.status).toBe(400);
    expect(invalidUrlUpload.json).toEqual({ error: "invalid_payload" });
  }

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
      listWardrobeItemsPageImpl: async () => {
        throw new Error("wardrobe_down");
      },
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

  const buildPdfFailure = vi.fn(async () => {
    throw new Error("pdf_down");
  });
  const failingServer = await startTestServer(t, {
    overrides: {
      buildWardrobePdfInChildImpl: buildPdfFailure,
      getPersonalItemsReportImpl: async () => null,
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
  expect(buildPdfFailure).toHaveBeenCalledTimes(1);
});
