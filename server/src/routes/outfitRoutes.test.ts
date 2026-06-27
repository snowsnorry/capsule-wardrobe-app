import { expect, test, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

const outfitItems = [
  {
    url: "https://example.com/shirt",
    source: "from_catalog",
  },
  {
    url: "wardrobe://missing",
    source: "uploaded",
  },
];

const outfit = {
  id: "outfit-1",
  name: "Weekend",
  draft: { items: outfitItems },
  saved: null,
  effective: { items: outfitItems },
  status: "new",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function authenticatedMutationOptions(body?: unknown) {
  return {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    ...(body === undefined ? {} : { body }),
  };
}

async function requestEventStream(
  baseUrl: string,
  pathname: string,
  {
    cookie,
    csrfToken,
    origin,
  }: { cookie?: string; csrfToken?: string; origin?: string } = {},
) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(origin ? { origin } : {}),
    },
  });

  return {
    response,
    text: await response.text(),
  };
}

function expectQueuedJob(result, kind, entity) {
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

test("outfit read routes return paginated, searched, and annotated outfits", async (t) => {
  const listRecentOutfitsImpl = vi.fn(async () => [outfit]);
  const countOutfitsImpl = vi.fn(async () => 12);
  const searchOutfitsImpl = vi.fn(async () => [{ ...outfit, id: "outfit-2" }]);
  const getOutfitImpl = vi.fn(async (_email, id) => {
    if (id === "missing") {
      return null;
    }
    if (id === "wardrobe-fallback") {
      return {
        ...outfit,
        id,
        draft: {
          items: [
            {
              url: "https://example.com/saved-only",
              source: "from_catalog",
            },
          ],
        },
        saved: null,
      };
    }
    return outfit;
  });
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listRecentOutfitsImpl,
      countOutfitsImpl,
      searchOutfitsImpl,
      getOutfitImpl,
      getProductsByUrlsForEmailImpl: async ({ urls }: { urls: string[] }) =>
        urls.includes("https://example.com/shirt")
          ? [
              {
                url: "https://example.com/shirt",
                name: "Shirt",
                category: "top",
              },
            ]
          : [],
      listWardrobeItemsByUrlsImpl: async ({
        source,
        urls,
      }: {
        source: string;
        urls: string[];
      }) =>
        source === "from_catalog" &&
        urls.includes("https://example.com/saved-only")
          ? [
              {
                url: "https://example.com/saved-only",
                name: "Saved-only catalog shirt",
                category: "top",
              },
            ]
          : [],
      listLikedItemUrlsImpl: async () => ["https://example.com/shirt"],
    },
  });

  const bootstrap = await requestJson(baseUrl, "/outfits/bootstrap", {
    cookie: AUTH_COOKIE,
  });
  expect(bootstrap.response.status).toBe(200);
  expect(bootstrap.json).toMatchObject({
    ok: true,
    pagination: { limit: 10, offset: 0, total: 12, hasMore: true },
  });
  expect(bootstrap.json.outfits).toEqual([
    expect.objectContaining({ id: "outfit-1", itemCount: 2 }),
  ]);

  const recent = await requestJson(
    baseUrl,
    "/outfits/recent?limit=100&offset=bad",
    { cookie: AUTH_COOKIE },
  );
  expect(recent.response.status).toBe(200);
  expect(recent.json.pagination).toEqual({
    limit: 50,
    offset: 0,
    total: 12,
    hasMore: false,
  });
  expect(listRecentOutfitsImpl).toHaveBeenLastCalledWith(
    "person@example.com",
    50,
    0,
  );

  const search = await requestJson(baseUrl, "/outfits/search?q=%20weekend", {
    cookie: AUTH_COOKIE,
  });
  expect(search.response.status).toBe(200);
  expect(search.json.outfits).toEqual([
    expect.objectContaining({ id: "outfit-2" }),
  ]);
  expect(searchOutfitsImpl).toHaveBeenCalledWith(
    "person@example.com",
    "weekend",
    25,
  );

  const emptySearch = await requestJson(baseUrl, "/outfits/search", {
    cookie: AUTH_COOKIE,
  });
  expect(emptySearch.response.status).toBe(200);
  expect(listRecentOutfitsImpl).toHaveBeenLastCalledWith(
    "person@example.com",
    25,
  );

  const detail = await requestJson(baseUrl, "/outfits/outfit-1", {
    cookie: AUTH_COOKIE,
  });
  expect(detail.response.status).toBe(200);
  const detailOutfit = detail.json.outfit as {
    effective: { items: Array<Record<string, unknown> & { item: unknown }> };
  };
  expect(detailOutfit.effective.items[0].item).toMatchObject({
    url: "https://example.com/shirt",
    isLiked: true,
  });
  expect(detailOutfit.effective.items[0]).not.toHaveProperty("isLiked");
  expect(detailOutfit.effective.items[1]).toMatchObject({
    url: "wardrobe://missing",
    source: "uploaded",
    item: null,
  });
  expect(detailOutfit.effective.items[1]).not.toHaveProperty("isLiked");

  const fallback = await requestJson(baseUrl, "/outfits/wardrobe-fallback", {
    cookie: AUTH_COOKIE,
  });
  expect(fallback.response.status).toBe(200);
  const fallbackOutfit = fallback.json.outfit as {
    effective: { items: Array<Record<string, unknown>> };
  };
  expect(fallbackOutfit.effective.items[0]).toMatchObject({
    url: "https://example.com/saved-only",
    source: "from_catalog",
    item: {
      url: "https://example.com/saved-only",
      source: "from_catalog",
      name: "Saved-only catalog shirt",
    },
  });

  const missing = await requestJson(baseUrl, "/outfits/missing", {
    cookie: AUTH_COOKIE,
  });
  expect(missing.response.status).toBe(404);
  expect(missing.json).toEqual({ error: "not_found" });
});

test("outfit mutation routes validate payloads and mutate profile-owned outfits", async (t) => {
  const createOutfitImpl = vi.fn(async (_email, payload) => ({
    ...outfit,
    ...payload,
    id: "outfit-created",
  }));
  const updateOutfitSnapshotImpl = vi.fn(async (_email, id, draft) => ({
    ...outfit,
    id,
    draft,
  }));
  const saveOutfitImpl = vi.fn(async (_email, id) =>
    id === "missing"
      ? null
      : { ...outfit, id, draft: null, saved: outfit.draft, status: "saved" },
  );
  const revertOutfitImpl = vi.fn(async (_email, id) =>
    id === "missing"
      ? null
      : { ...outfit, id, draft: null, saved: outfit.draft, status: "saved" },
  );
  const renameOutfitImpl = vi.fn(async (_email, id, name) => ({
    ...outfit,
    id,
    name,
  }));
  const setOutfitPinImpl = vi.fn(async (_email, id, pin) =>
    id === "missing" ? null : { ...outfit, id, pin },
  );
  const duplicateOutfitImpl = vi.fn(async (_email, id, name) =>
    id === "missing" ? null : { ...outfit, id: "outfit-copy", name },
  );
  const sourceCopyItems = [
    ...outfitItems,
    {
      url: "https://example.com/bag",
      source: "from_catalog",
    },
  ];
  const getOutfitImpl = vi.fn(async (_email, id) => {
    if (id === "missing") return null;
    if (id === "with-image") {
      return {
        ...outfit,
        id,
        draft: {
          items: outfitItems,
          image: "https://images.example.com/outfit.png",
          imageObsolete: false,
        },
      };
    }
    return { ...outfit, id };
  });
  const getCapsuleImpl = vi.fn(async () => ({
    id: "capsule-1",
    draft: {
      filters: {},
      data: {
        wardrobe: {
          items: [
            {
              id: "top-1",
              url: "https://example.com/shirt",
              source: "from_catalog",
            },
            {
              id: "missing-1",
              url: "wardrobe://missing",
              source: "uploaded",
            },
            {
              id: "bag-1",
              url: "https://example.com/bag",
              source: "from_catalog",
            },
          ],
          outfitSets: [
            {
              itemIds: ["top-1", "missing-1", "bag-1"],
              image: "https://images.example.com/source.png",
              imageObsolete: false,
            },
            {
              itemIds: ["top-1", "missing-1", "bag-1"],
              image: "https://images.example.com/source-stale.png",
              imageObsolete: false,
            },
          ],
        },
        rejectedUrls: [],
      },
    },
    saved: null,
  }));
  const copyImageObjectToR2Impl = vi.fn(async () => ({
    key: "copied/outfit.png",
    url: "https://images.example.com/copied.png",
    digest: "digest",
  }));
  const deleteOutfitImpl = vi.fn(async (_email, id) => id !== "missing");
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      createOutfitImpl,
      updateOutfitSnapshotImpl,
      saveOutfitImpl,
      revertOutfitImpl,
      renameOutfitImpl,
      setOutfitPinImpl,
      duplicateOutfitImpl,
      getOutfitImpl,
      getCapsuleImpl,
      copyImageObjectToR2Impl,
      deleteOutfitImpl,
      getProductsByUrlsForEmailImpl: async () => [
        {
          url: "https://example.com/shirt",
          name: "Shirt",
          category: "top",
        },
      ],
      listWardrobeItemsByUrlsImpl: async () => [],
      listRecentOutfitsImpl: async () => [outfit],
      countOutfitsImpl: async () => 1,
      listLikedItemUrlsImpl: async () => [],
    },
  });

  const invalidCreate = await requestJson(
    baseUrl,
    "/outfits",
    authenticatedMutationOptions({ name: "Weekend", saved: {} }),
  );
  expect(invalidCreate.response.status).toBe(400);
  expect(invalidCreate.json).toEqual({ error: "invalid_payload" });

  const created = await requestJson(
    baseUrl,
    "/outfits",
    authenticatedMutationOptions({ name: " Weekend ", items: outfitItems }),
  );
  expect(created.response.status).toBe(201);
  expect(createOutfitImpl).toHaveBeenCalledWith("person@example.com", {
    name: "Weekend",
    draft: { items: outfitItems },
    saved: null,
  });

  const copied = await requestJson(
    baseUrl,
    "/outfits",
    authenticatedMutationOptions({
      name: "Copied",
      items: sourceCopyItems,
      sourceCapsuleId: "capsule-1",
      sourceSetIndex: 0,
    }),
  );
  expect(copied.response.status).toBe(201);
  expect(copyImageObjectToR2Impl).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceUrl: "https://images.example.com/source.png",
      namespace: "copied",
      setIndex: 0,
    }),
  );
  expect(createOutfitImpl).toHaveBeenLastCalledWith("person@example.com", {
    name: "Copied",
    draft: {
      items: sourceCopyItems,
      image: "https://images.example.com/copied.png",
      imageObsolete: false,
    },
    saved: null,
  });

  const staleCopied = await requestJson(
    baseUrl,
    "/outfits",
    authenticatedMutationOptions({
      name: "Stale copied",
      items: outfitItems,
      sourceCapsuleId: "capsule-1",
      sourceSetIndex: 1,
    }),
  );
  expect(staleCopied.response.status).toBe(201);
  expect(createOutfitImpl).toHaveBeenLastCalledWith("person@example.com", {
    name: "Stale copied",
    draft: {
      items: outfitItems,
      image: "https://images.example.com/copied.png",
      imageObsolete: true,
    },
    saved: null,
  });

  const invalidItems = await requestJson(baseUrl, "/outfits/outfit-1/items", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { items: [], saved: {} },
  });
  expect(invalidItems.response.status).toBe(400);

  const updatedItems = await requestJson(baseUrl, "/outfits/outfit-1/items", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { items: [] },
  });
  expect(updatedItems.response.status).toBe(200);
  expect(updateOutfitSnapshotImpl).toHaveBeenCalledWith(
    "person@example.com",
    "outfit-1",
    { items: [], image: null, imageObsolete: false },
  );

  const updatedWithImage = await requestJson(
    baseUrl,
    "/outfits/with-image/items",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { items: [] },
    },
  );
  expect(updatedWithImage.response.status).toBe(200);
  expect(updateOutfitSnapshotImpl).toHaveBeenLastCalledWith(
    "person@example.com",
    "with-image",
    {
      items: [],
      image: "https://images.example.com/outfit.png",
      imageObsolete: true,
    },
  );

  const saved = await requestJson(
    baseUrl,
    "/outfits/outfit-1/save",
    authenticatedMutationOptions(),
  );
  expect(saved.response.status).toBe(200);
  expect((saved.json.outfit as { status?: string }).status).toBe("saved");

  const missingSave = await requestJson(
    baseUrl,
    "/outfits/missing/save",
    authenticatedMutationOptions(),
  );
  expect(missingSave.response.status).toBe(404);

  const reverted = await requestJson(
    baseUrl,
    "/outfits/outfit-1/revert",
    authenticatedMutationOptions(),
  );
  expect(reverted.response.status).toBe(200);

  const missingRevert = await requestJson(
    baseUrl,
    "/outfits/missing/revert",
    authenticatedMutationOptions(),
  );
  expect(missingRevert.response.status).toBe(404);

  const invalidRename = await requestJson(baseUrl, "/outfits/outfit-1/rename", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: " " },
  });
  expect(invalidRename.response.status).toBe(400);

  const renamed = await requestJson(baseUrl, "/outfits/outfit-1/rename", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: " Travel " },
  });
  expect(renamed.response.status).toBe(200);
  expect(renameOutfitImpl).toHaveBeenCalledWith(
    "person@example.com",
    "outfit-1",
    "Travel",
  );

  const pinned = await requestJson(baseUrl, "/outfits/outfit-1/pin", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { pin: true },
  });
  expect(pinned.response.status).toBe(200);
  expect(setOutfitPinImpl).toHaveBeenCalledWith(
    "person@example.com",
    "outfit-1",
    true,
  );
  expect((pinned.json.outfit as { pin?: boolean }).pin).toBe(true);

  const invalidPin = await requestJson(baseUrl, "/outfits/outfit-1/pin", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { pin: "true" },
  });
  expect(invalidPin.response.status).toBe(400);
  expect(invalidPin.json).toEqual({ error: "invalid_payload" });

  const missingPin = await requestJson(baseUrl, "/outfits/missing/pin", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { pin: true },
  });
  expect(missingPin.response.status).toBe(404);
  expect(missingPin.json).toEqual({ error: "not_found" });

  const duplicated = await requestJson(
    baseUrl,
    "/outfits/outfit-1/duplicate",
    authenticatedMutationOptions({ name: " Copy " }),
  );
  expect(duplicated.response.status).toBe(201);
  expect(duplicateOutfitImpl).toHaveBeenCalledWith(
    "person@example.com",
    "outfit-1",
    "Copy",
  );

  const missingDuplicate = await requestJson(
    baseUrl,
    "/outfits/missing/duplicate",
    authenticatedMutationOptions(),
  );
  expect(missingDuplicate.response.status).toBe(404);

  const selected = await requestJson(
    baseUrl,
    "/outfits/outfit-1/select",
    authenticatedMutationOptions(),
  );
  expect(selected.response.status).toBe(200);
  expect(selected.json).toEqual({ ok: true, outfitId: "outfit-1" });

  const missingSelect = await requestJson(
    baseUrl,
    "/outfits/missing/select",
    authenticatedMutationOptions(),
  );
  expect(missingSelect.response.status).toBe(404);

  const deleted = await requestJson(baseUrl, "/outfits/outfit-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true });

  const missingDelete = await requestJson(baseUrl, "/outfits/missing", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(missingDelete.response.status).toBe(404);
});

test("outfit image routes delegate to generated image handlers", async (t) => {
  const generateOutfitImageHandler = vi.fn(async (_req, res) =>
    res.status(202).json({ ok: true, status: "pending" }),
  );
  const deleteOutfitImageHandler = vi.fn(async (_req, res) =>
    res.json({ ok: true, status: "ready" }),
  );
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      generateOutfitImageHandler,
      deleteOutfitImageHandler,
    },
  });

  const generated = await requestJson(
    baseUrl,
    "/outfits/outfit-1/image",
    authenticatedMutationOptions(),
  );
  expect(generated.response.status).toBe(202);
  expect(generateOutfitImageHandler).toHaveBeenCalledTimes(1);

  const deleted = await requestJson(baseUrl, "/outfits/outfit-1/image", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect(deleteOutfitImageHandler).toHaveBeenCalledTimes(1);
});

test("outfit report route delegates to generator and maps report errors", async (t) => {
  const generateOutfitReportImpl = vi.fn(async (_email, id) => {
    if (id === "missing") {
      const error = new Error("not_found") as Error & { code?: string };
      error.code = "not_found";
      throw error;
    }
    if (id === "empty") {
      const error = new Error("invalid_payload") as Error & { code?: string };
      error.code = "invalid_payload";
      throw error;
    }
    if (id === "llm-failed") {
      throw new Error("llm_failed");
    }
    return {
      schemaVersion: 1,
      itemsHash: "items-hash",
      verdict: { status: "valid", score: 0.9, summary: "Ready." },
    };
  });
  const updateOutfitReportImpl = vi.fn(async (_email, id, report) =>
    id === "missing" ? null : { ...outfit, draft: { ...outfit.draft, report } },
  );
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      generateOutfitReportImpl,
      getOutfitImpl: async (_email, id) => ({ ...outfit, id }),
      updateOutfitReportImpl,
      getProductsByUrlsForEmailImpl: async () => [],
      listLikedItemUrlsImpl: async () => [],
      listWardrobeItemsByUrlsImpl: async () => [],
    },
  });

  const generated = await requestEventStream(
    baseUrl,
    "/outfits/outfit-1/report",
    authenticatedMutationOptions(),
  );
  expectQueuedJob(generated, "outfitReportGenerate", {
    type: "outfit",
    id: "outfit-1",
  });
  expect(generateOutfitReportImpl).not.toHaveBeenCalled();

  const missingCsrf = await requestJson(baseUrl, "/outfits/outfit-1/report", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
  });
  expect(missingCsrf.response.status).toBe(403);

  for (const outfitId of ["missing", "empty", "llm-failed"]) {
    const queued = await requestEventStream(
      baseUrl,
      `/outfits/${outfitId}/report`,
      authenticatedMutationOptions(),
    );
    expectQueuedJob(queued, "outfitReportGenerate", {
      type: "outfit",
      id: outfitId,
    });
  }

  const deleted = await requestJson(baseUrl, "/outfits/outfit-1/report", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toMatchObject({
    ok: true,
    outfit: { id: "outfit-1", effective: { report: null } },
  });
  expect(updateOutfitReportImpl).toHaveBeenCalledWith(
    "person@example.com",
    "outfit-1",
    null,
  );

  const deleteMissing = await requestJson(baseUrl, "/outfits/missing/report", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleteMissing.response.status).toBe(404);
});

test("outfit pdf route renders effective outfit items with the profile locale", async (t) => {
  let pdfProducts: unknown = null;
  let pdfLocale = "";
  let pdfOptions: unknown = null;
  const report = {
    itemsHash: "stale-report-hash",
    verdict: {
      status: "valid",
      score: 0.9,
      summary: "Ready to wear.",
    },
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getOutfitImpl: async (_email, id) =>
        id === "empty"
          ? { ...outfit, id, draft: { items: [] }, saved: null }
          : id === "missing"
            ? null
            : id === "unresolved"
              ? {
                  ...outfit,
                  id,
                  draft: {
                    items: [
                      {
                        url: "https://example.com/ghost",
                        source: "from_catalog",
                      },
                    ],
                  },
                  saved: null,
                }
              : {
                  ...outfit,
                  draft: {
                    items: outfitItems,
                    image: "https://images.example.com/outfit.png",
                    imageObsolete: true,
                    report,
                  },
                  saved: null,
                },
      getProductsByUrlsForEmailImpl: async ({ urls }: { urls: string[] }) =>
        urls.includes("https://example.com/shirt")
          ? [
              {
                url: "https://example.com/shirt",
                name: "Shirt",
                category: "top",
              },
            ]
          : [],
      listWardrobeItemsByUrlsImpl: async () => [],
      getProfileImpl: async () => ({ locale: "ru" }),
      buildWardrobePdfInChildImpl: async (products, locale, options) => {
        pdfProducts = products;
        pdfLocale = locale;
        pdfOptions = options;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(
    baseUrl,
    "/outfits/outfit-1/pdf",
    authenticatedMutationOptions(),
  );
  expect(pdf.response.status).toBe(200);
  expect(pdf.response.headers.get("content-type")).toContain("application/pdf");
  expect(pdf.response.headers.get("content-disposition")).toBe(
    `attachment; filename="Weekend.pdf"; filename*=UTF-8''${encodeURIComponent("Weekend.pdf")}`,
  );
  expect(pdfProducts).toEqual([
    expect.objectContaining({ url: "https://example.com/shirt" }),
  ]);
  expect(pdfLocale).toBe("ru");
  expect(pdfOptions).toEqual({
    outfit: {
      title: "Weekend",
      imageUrl: "https://images.example.com/outfit.png",
      imageStale: true,
      report,
      reportStale: true,
    },
  });

  const empty = await requestJson(
    baseUrl,
    "/outfits/empty/pdf",
    authenticatedMutationOptions(),
  );
  expect(empty.response.status).toBe(404);

  const unresolved = await requestJson(
    baseUrl,
    "/outfits/unresolved/pdf",
    authenticatedMutationOptions(),
  );
  expect(unresolved.response.status).toBe(404);

  const missing = await requestJson(
    baseUrl,
    "/outfits/missing/pdf",
    authenticatedMutationOptions(),
  );
  expect(missing.response.status).toBe(404);
});

test("outfit routes map dependency failures to service_unavailable", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listRecentOutfitsImpl: async () => {
        throw new Error("db down");
      },
      createOutfitImpl: async () => {
        throw new Error("db down");
      },
      getOutfitImpl: async () => {
        throw new Error("db down");
      },
    },
  });

  const recent = await requestJson(baseUrl, "/outfits/recent", {
    cookie: AUTH_COOKIE,
  });
  expect(recent.response.status).toBe(503);
  expect(recent.json).toEqual({ error: "service_unavailable" });

  const created = await requestJson(
    baseUrl,
    "/outfits",
    authenticatedMutationOptions({ items: [] }),
  );
  expect(created.response.status).toBe(503);

  const pdf = await requestJson(
    baseUrl,
    "/outfits/outfit-1/pdf",
    authenticatedMutationOptions(),
  );
  expect(pdf.response.status).toBe(503);
});
