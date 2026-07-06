import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";
import { hashCapsuleContent } from "../db.js";
import { toOutfitReportItem } from "../ai/outfitReportItems.js";
import { normalizeCapsuleFilters } from "../capsuleStore.js";

const NO_GENERATED_OUTFITS_MESSAGE =
  "No generated outfit sets were provided for this capsule.";

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

function createQueuedJob(input) {
  return {
    id: `${input.kind}-${String(input.entity?.id || "job")}`,
    kind: input.kind,
    status: "queued",
    phase: input.phase || "queued",
    progress: {
      current: 0,
      total: input.progressTotal ?? null,
      label: input.progressLabel || null,
    },
    entity: input.entity || null,
    result: null,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
  };
}

test("capsule action routes cover wardrobe handlers and pdf download", async (t) => {
  let wardrobeCalled = false;
  let fullRegenerateCalled = false;
  let regenerateCalled = false;
  let pdfLocale = null;
  let pdfOptions = null;
  let pdfProducts = null;

  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "New capsule",
        draft: {
          filters: {},
          data: {
            wardrobe: {
              items: [
                {
                  id: "top-1",
                  category: "top",
                  url: "https://example.com/top-1",
                  source: "from_catalog",
                },
                {
                  id: "bottom-1",
                  category: "bottom",
                  url: "https://example.com/bottom-1",
                  source: "from_catalog",
                },
                {
                  id: "bag-1",
                  category: "bag",
                  url: "https://example.com/bag-1",
                  source: "from_catalog",
                },
              ],
              outfitSets: [
                { itemIds: ["top-1", "bottom-1", "bag-1"], image: null },
              ],
            },
            rejectedUrls: [],
          },
        },
        saved: null,
        status: "new",
      }),
      streamCapsuleEventsImpl: async (_req, res, { snapshot }) => {
        wardrobeCalled = true;
        res.json({ ok: true, snapshot });
      },
      regenerateCapsuleWardrobeHandler: async (_req, res) => {
        fullRegenerateCalled = true;
        res.status(202).json({ ok: true, status: "pending", items: [] });
      },
      regenerateSelectedCapsuleItemsHandler: async (_req, res) => {
        regenerateCalled = true;
        res.json({ ok: true, items: [{ id: "2" }] });
      },
      buildWardrobePdfInChildImpl: async (products, locale, options) => {
        pdfProducts = products;
        pdfLocale = locale;
        pdfOptions = options;
        return Buffer.from("pdf");
      },
      getProductsByUrlsInOrderImpl: async (urls: string[]) =>
        urls.map((url) => ({
          url,
          source: "from_catalog",
          category: url.includes("bottom")
            ? "bottom"
            : url.includes("bag")
              ? "bag"
              : "top",
          name: url,
        })),
      getProductsByUrlsForEmailImpl: async ({ urls }: { urls: string[] }) =>
        urls.map((url) => ({
          url,
          source: "from_catalog",
          category: url.includes("bottom")
            ? "bottom"
            : url.includes("bag")
              ? "bag"
              : "top",
          name: url,
        })),
    },
  });

  const wardrobe = await requestJson(baseUrl, "/capsules/capsule-1/events", {
    cookie: AUTH_COOKIE,
  });
  expect(wardrobe.response.status).toBe(200);
  expect(wardrobeCalled).toBe(true);
  expect(wardrobe.json.snapshot.status).toBe("ready");

  const fullRegenerate = await requestJson(
    baseUrl,
    "/capsules/capsule-1/regenerate",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(fullRegenerate.response.status).toBe(202);
  expect(fullRegenerate.json).toMatchObject({
    ok: true,
    job: {
      kind: "capsuleGenerate",
      status: "queued",
      entity: { type: "capsule", id: "capsule-1" },
    },
  });
  expect(fullRegenerateCalled).toBe(false);

  const regenerate = await requestJson(
    baseUrl,
    "/capsules/capsule-1/regenerate-selected",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { itemUrls: ["https://example.com/1"] },
    },
  );
  expectQueuedJob(regenerate, "capsuleRegenerateSelected", {
    type: "capsule",
    id: "capsule-1",
  });
  expect(regenerateCalled).toBe(false);

  const outfitSetImage = await requestJson(
    baseUrl,
    "/capsules/capsule-1/outfit-sets/0/image",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expectQueuedJob(outfitSetImage, "outfitSetImageGenerate", {
    type: "capsule",
    id: "capsule-1",
  });

  const removedWardrobeRoute = await requestJson(
    baseUrl,
    "/capsules/capsule-1/items",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(removedWardrobeRoute.response.status).toBe(404);

  const pdf = await requestJson(baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(pdf.response.status).toBe(200);
  expect(pdfLocale).toBe("en");
  expect(pdf.response.headers.get("content-disposition")).toBe(
    `attachment; filename="New-capsule.pdf"; filename*=UTF-8''${encodeURIComponent("New capsule.pdf")}`,
  );
  expect(pdfOptions).toBeUndefined();
  expect(pdfProducts).toHaveLength(3);
  expect(pdfProducts?.[0]).toMatchObject({ url: "https://example.com/top-1" });
});

test("capsule report route delegates to generator and maps report errors", async (t) => {
  const generateCapsuleReportImpl = vi.fn(async (_email, id) => {
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
      itemsHash: "capsule-report-hash",
      verdict: {
        llmScore: 0.9,
        score: 0.9,
        status: "good",
        summary: "Ready.",
      },
    };
  });
  const updateCapsuleReportImpl = vi.fn(async (_email, id, report) =>
    id === "missing"
      ? null
      : {
          id,
          draft: {
            filters: {},
            data: { wardrobe: { items: [] }, rejectedUrls: [] },
            report,
          },
          saved: null,
          status: "new",
        },
  );
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      generateCapsuleReportImpl,
      enqueueJobImpl: async (input) => createQueuedJob(input),
      updateCapsuleReportImpl,
      listLikedItemUrlsImpl: async () => [],
      listWardrobeItemsImpl: async () => [],
    },
  });

  const generated = await requestEventStream(
    baseUrl,
    "/capsules/capsule-1/report",
    authenticatedMutationOptions(),
  );
  expectQueuedJob(generated, "capsuleReportGenerate", {
    type: "capsule",
    id: "capsule-1",
  });
  expect(generateCapsuleReportImpl).not.toHaveBeenCalled();

  const missingCsrf = await requestJson(baseUrl, "/capsules/capsule-1/report", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
  });
  expect(missingCsrf.response.status).toBe(403);

  for (const capsuleId of ["missing", "empty", "llm-failed"]) {
    const queued = await requestEventStream(
      baseUrl,
      `/capsules/${capsuleId}/report`,
      authenticatedMutationOptions(),
    );
    expectQueuedJob(queued, "capsuleReportGenerate", {
      type: "capsule",
      id: capsuleId,
    });
  }

  const deleted = await requestJson(baseUrl, "/capsules/capsule-1/report", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toMatchObject({
    ok: true,
    capsule: { id: "capsule-1", effective: { report: null } },
  });
  expect(updateCapsuleReportImpl).toHaveBeenCalledWith(
    "person@example.com",
    "capsule-1",
    null,
  );

  const deleteMissing = await requestJson(baseUrl, "/capsules/missing/report", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleteMissing.response.status).toBe(404);
});

test("capsule responses report whether capsule reports are stale", async (t) => {
  const filters = {
    sourceMode: "catalog_only",
    formalityLevel: "casual",
    style: "minimalistic",
    occasions: ["office"],
    season: ["spring"],
    audience: "woman",
    color: null,
    pattern: "solid",
    text: "",
    anchorItemRefs: [],
  };
  const item = {
    id: "catalog-1",
    source: "from_catalog",
    url: "https://example.com/1",
    name: "Shirt",
    category: "top",
  };
  const reportItem = toOutfitReportItem(item);
  const currentItemsHash = hashCapsuleContent({
    filters,
    generatedOutfits: NO_GENERATED_OUTFITS_MESSAGE,
    items: [reportItem],
  });
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "Spring edit",
        draft: {
          filters,
          data: {
            wardrobe: { items: [item], outfitSets: [] },
            rejectedUrls: [],
          },
          report: { schemaVersion: 1, itemsHash: currentItemsHash },
        },
        saved: {
          filters,
          data: {
            wardrobe: { items: [item], outfitSets: [{ itemIds: [] }] },
            rejectedUrls: [],
          },
          report: { schemaVersion: 1, itemsHash: currentItemsHash },
        },
        status: "modified",
      }),
      listLikedItemUrlsImpl: async () => [],
      listWardrobeItemsImpl: async () => [],
    },
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1", {
    cookie: AUTH_COOKIE,
  });

  expect(result.response.status).toBe(200);
  expect(result.json.capsule).toMatchObject({
    draft: { reportMeta: { stale: false } },
    saved: { reportMeta: { stale: true } },
    effective: { reportMeta: { stale: false } },
  });
});

test("capsule pdf route includes uploaded wardrobe items from capsule snapshots", async (t) => {
  let pdfProducts = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "Mixed capsule",
        draft: {
          filters: {},
          data: {
            wardrobe: {
              items: [
                { id: "catalog-1", url: "https://example.com/1" },
                {
                  id: "snapshot-uploaded-7",
                  wardrobeId: "7",
                  url: "wardrobe://7",
                  name: "Snapshot uploaded shirt",
                  imageUrl: "https://images.example.com/snapshot.webp",
                  source: "uploaded",
                },
                {
                  id: "legacy-url-only",
                  url: "wardrobe://9",
                  name: "Legacy URL-only uploaded shirt",
                },
              ],
            },
            rejectedUrls: [],
          },
        },
        saved: null,
        status: "new",
      }),
      getProductsByUrlsInOrderImpl: async (urls) =>
        urls.map((url) => ({ name: "Catalog shirt", url })),
      listWardrobeItemsByIdsImpl: async ({ email, ids }) => {
        expect(email).toBe("person@example.com");
        expect(ids).toEqual([7]);
        return [
          {
            id: 7,
            name: "Uploaded shirt",
            url: "wardrobe://7",
            imageUrl: "https://images.example.com/uploaded.webp",
            rawImageUrl: "https://images.example.com/uploaded-raw.webp",
            source: "uploaded",
            category: "top",
          },
        ];
      },
      buildWardrobePdfInChildImpl: async (products) => {
        pdfProducts = products;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });

  expect(pdf.response.status).toBe(200);
  expect(pdfProducts).toHaveLength(2);
  expect(pdfProducts?.[0]).toMatchObject({
    name: "Catalog shirt",
    url: "https://example.com/1",
  });
  expect(pdfProducts?.[1]).toEqual({
    id: 7,
    name: "Uploaded shirt",
    url: "wardrobe://7",
    imageUrl: "https://images.example.com/uploaded.webp",
    rawImageUrl: "https://images.example.com/uploaded-raw.webp",
    source: "uploaded",
    category: "top",
    formalityLevel: null,
    colorBase: null,
    isNeutral: null,
    closureType: null,
  });
});

test("capsule pdf route passes existing capsule report options to the builder", async (t) => {
  let pdfLocale = null;
  let pdfOptions = null;
  let pdfProducts = null;
  const filters = {};
  const item = {
    id: "catalog-1",
    url: "https://example.com/1",
    name: "Linen shirt",
    category: "top",
    style: ["minimal"],
  };
  const reportItem = toOutfitReportItem(item);
  const report = {
    schemaVersion: 1,
    itemsHash: hashCapsuleContent({
      filters: normalizeCapsuleFilters(filters),
      generatedOutfits: NO_GENERATED_OUTFITS_MESSAGE,
      items: [reportItem],
    }),
    verdict: {
      llmScore: 0.9,
      llmStatus: "excellent",
      score: 0.9,
      status: "excellent",
      summary: "Balanced capsule.",
    },
  };

  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "Summer edit",
        draft: {
          filters,
          data: {
            wardrobe: {
              items: [item],
              outfitSets: [],
            },
            rejectedUrls: [],
          },
          report,
        },
        saved: null,
        status: "new",
      }),
      getProductsByUrlsInOrderImpl: async (urls) =>
        urls.map((url) => ({ name: "Linen shirt", url })),
      getProfileImpl: async () => ({ locale: "ru" }),
      buildWardrobePdfInChildImpl: async (products, locale, options) => {
        pdfProducts = products;
        pdfLocale = locale;
        pdfOptions = options;
        return Buffer.from("pdf");
      },
    },
  });

  const pdf = await requestJson(baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });

  expect(pdf.response.status).toBe(200);
  expect(pdfLocale).toBe("ru");
  expect(pdfProducts).toEqual([
    expect.objectContaining({ url: "https://example.com/1" }),
  ]);
  expect(pdfOptions).toEqual({
    capsule: {
      title: "Summer edit",
      report,
      reportStale: false,
    },
  });
});

test("capsule creation only accepts name and filters and initializes server-owned data", async (t) => {
  let receivedPayload = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      createCapsuleImpl: async (_email, payload) => {
        receivedPayload = payload;
        return {
          id: "capsule-2",
          draft: payload.draft,
          saved: null,
          status: "new",
        };
      },
    },
  });

  const result = await requestJson(baseUrl, "/capsules", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      name: "Spring edit",
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        sourceMode: "wardrobe_preferred",
        occasions: ["office", "", null],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
      },
    },
  });

  expect(result.response.status).toBe(201);
  expect(receivedPayload).toEqual({
    name: "Spring edit",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        sourceMode: "wardrobe_preferred",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
        text: "",
        anchorItemRefs: [],
      },
      data: {
        wardrobe: null,
        rejectedUrls: [],
      },
    },
    saved: null,
  });
});

test("capsule creation rejects client-supplied state-bearing fields", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const result = await requestJson(baseUrl, "/capsules", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      name: "Spring edit",
      sourceMode: "wardrobe_preferred",
      draft: {
        filters: { audience: "woman" },
        data: {
          wardrobe: { items: [{ url: "https://malicious.example/item" }] },
          rejectedUrls: ["https://malicious.example/rejected"],
        },
      },
    },
  });

  expect(result.response.status).toBe(400);
  expect(result.json).toEqual({ error: "invalid_payload" });
});

test("capsule mutation responses annotate liked item state", async (t) => {
  type CapsuleMutationJson = {
    capsule: {
      draft?: { data?: { wardrobe?: { items?: { isLiked?: boolean }[] } } };
      saved?: { data?: { wardrobe?: { items?: { isLiked?: boolean }[] } } };
    };
  };
  const getCapsule = (json: unknown) => (json as CapsuleMutationJson).capsule;
  const likedUrl = "https://example.com/1";
  const likedWardrobe = {
    items: [{ url: likedUrl }, { url: "https://example.com/2" }],
  };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listLikedItemUrlsImpl: async () => [likedUrl],
      createCapsuleImpl: async (_email, payload) => ({
        id: "capsule-created",
        ...payload,
        draft: {
          ...payload.draft,
          data: { wardrobe: likedWardrobe, rejectedUrls: [] },
        },
        status: "new",
      }),
      updateCapsuleSnapshotImpl: async (_email, id, draft) => ({
        id,
        draft: {
          ...draft,
          data: {
            wardrobe: likedWardrobe,
            rejectedUrls: draft?.data?.rejectedUrls || [],
          },
        },
        saved: null,
        status: "new",
      }),
      saveCapsuleImpl: async (_email, id) => ({
        id,
        draft: null,
        saved: { filters: {}, data: { wardrobe: likedWardrobe } },
        status: "saved",
      }),
    },
  });

  const create = await requestJson(baseUrl, "/capsules", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "Liked capsule", filters: {} },
  });
  expect(create.response.status).toBe(201);
  expect(
    getCapsule(create.json).draft?.data?.wardrobe?.items?.[0]?.isLiked,
  ).toBe(true);
  expect(
    getCapsule(create.json).draft?.data?.wardrobe?.items?.[1]?.isLiked,
  ).toBe(false);

  const filters = await requestJson(baseUrl, "/capsules/capsule-1/filters", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { filters: {} },
  });
  expect(filters.response.status).toBe(200);
  expect(
    getCapsule(filters.json).draft?.data?.wardrobe?.items?.[0]?.isLiked,
  ).toBe(true);

  const rejected = await requestJson(
    baseUrl,
    "/capsules/capsule-1/rejected-urls",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { rejectedUrls: [likedUrl] },
    },
  );
  expect(rejected.response.status).toBe(200);
  expect(
    getCapsule(rejected.json).draft?.data?.wardrobe?.items?.[0]?.isLiked,
  ).toBe(true);

  const save = await requestJson(baseUrl, "/capsules/capsule-1/save", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(save.response.status).toBe(200);
  expect(getCapsule(save.json).saved?.data?.wardrobe?.items?.[0]?.isLiked).toBe(
    true,
  );
});

test("filters patch only accepts filters and resets draft data", async (t) => {
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      },
    },
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/filters", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        sourceMode: "wardrobe_preferred",
        occasions: ["office", "", null],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
        text: "  Prefer natural fabrics  ",
        ignoredField: "ignored",
      },
    },
  });

  expect(result.response.status).toBe(200);
  expect(receivedDraft).toEqual({
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      sourceMode: "wardrobe_preferred",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: "red",
      pattern: "striped",
      text: "Prefer natural fabrics",
      anchorItemRefs: [],
    },
    data: {
      wardrobe: null,
      rejectedUrls: [],
    },
  });

  const invalidTopLevel = await requestJson(
    baseUrl,
    "/capsules/capsule-1/filters",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        filters: {},
        sourceMode: "wardrobe_preferred",
      },
    },
  );
  expect(invalidTopLevel.response.status).toBe(400);
  expect(invalidTopLevel.json).toEqual({ error: "invalid_payload" });
});

test("filters patch normalizes and validates anchor item refs", async (t) => {
  let receivedAnchorRefs = null;
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      validateCapsuleAnchorItemsImpl: async (_email, anchorRefs) => {
        receivedAnchorRefs = anchorRefs;
        return {
          anchorWardrobeNumericIds: [12, 18],
          anchorCatalogUrls: ["https://example.com/catalog-coat"],
          anchorItemRefs: [
            { source: "uploaded", url: "wardrobe://12" },
            { source: "from_catalog", url: "https://example.com/catalog-coat" },
          ],
          anchorItems: [],
        };
      },
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      },
    },
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/filters", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      filters: {
        audience: "woman",
        anchorItemRefs: [
          { source: "uploaded", url: "wardrobe://12" },
          { source: "from_catalog", url: "https://example.com/catalog-coat" },
        ],
      },
    },
  });

  expect(result.response.status).toBe(200);
  expect(receivedAnchorRefs).toEqual([
    { source: "uploaded", url: "wardrobe://12" },
    { source: "from_catalog", url: "https://example.com/catalog-coat" },
  ]);
  expect(receivedDraft?.filters.anchorItemRefs).toEqual([
    { source: "uploaded", url: "wardrobe://12" },
    { source: "from_catalog", url: "https://example.com/catalog-coat" },
  ]);
});

test("filters patch rejects invalid anchor refs", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      validateCapsuleAnchorItemsImpl: async () => {
        const error = new Error("invalid_payload") as Error & { code: string };
        error.code = "invalid_payload";
        throw error;
      },
    },
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/filters", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      filters: {
        anchorItemRefs: [{ source: "uploaded", url: "not-a-wardrobe-url" }],
      },
    },
  });

  expect(result.response.status).toBe(400);
  expect(result.json).toEqual({ error: "invalid_payload" });
});

test("filters patch can trigger regenerate via query flag after saving filters", async (t) => {
  const calls = [];
  const enqueuedJobs = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        calls.push({ type: "update", draft });
        return { id: "capsule-1", draft, saved: null, status: "new" };
      },
      enqueueJobImpl: async (input) => {
        enqueuedJobs.push(input);
        return {
          id: "job-1",
          kind: input.kind,
          status: "queued",
          phase: input.phase,
          progress: { current: 0, total: null, label: input.progressLabel },
          entity: input.entity,
          result: null,
          error: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          startedAt: null,
          completedAt: null,
          failedAt: null,
        };
      },
    },
  });

  const result = await requestJson(
    baseUrl,
    "/capsules/capsule-1/filters?regenerate=true",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        filters: {
          audience: "woman",
          season: ["summer"],
        },
      },
    },
  );

  expect(result.response.status).toBe(202);
  expect(result.json).toMatchObject({
    ok: true,
    job: {
      kind: "capsuleGenerate",
      status: "queued",
      entity: { type: "capsule", id: "capsule-1" },
    },
  });
  expect(enqueuedJobs[0]?.dedupeKey).toMatch(
    /^capsuleGenerate:capsule-1:[a-f0-9]{64}$/,
  );
  expect(calls).toEqual([
    {
      type: "update",
      draft: {
        filters: {
          formalityLevel: "",
          style: null,
          sourceMode: "catalog_only",
          occasions: [],
          audience: "woman",
          season: ["summer"],
          color: null,
          pattern: "solid",
          text: "",
          anchorItemRefs: [],
        },
        data: {
          wardrobe: null,
          rejectedUrls: [],
        },
      },
    },
  ]);
});

test("filters patch maps regenerate active job caps to 429", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      enqueueJobImpl: async () => {
        const error = new Error("too_many_active_jobs") as Error & {
          code: string;
        };
        error.code = "too_many_active_jobs";
        throw error;
      },
    },
  });

  const result = await requestJson(
    baseUrl,
    "/capsules/capsule-1/filters?regenerate=true",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { filters: {} },
    },
  );

  expect(result.response.status).toBe(429);
  expect(result.json).toEqual({ error: "too_many_active_jobs" });
});

test("rejected urls patch validates against current capsule wardrobe", async (t) => {
  let receivedDraft = null;
  const report = { schemaVersion: 1, itemsHash: "capsule-report-hash" };
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "<New capsule>",
        draft: {
          filters: {
            formalityLevel: "casual",
            style: "minimalistic",
            occasions: ["office"],
            season: ["spring"],
            audience: "woman",
            color: null,
            pattern: "solid",
            text: "",
          },
          data: {
            wardrobe: { items: [{ url: "https://example.com/1" }] },
            rejectedUrls: [],
          },
          report,
        },
        saved: null,
        status: "new",
      }),
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      },
    },
  });

  const result = await requestJson(
    baseUrl,
    "/capsules/capsule-1/rejected-urls",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        rejectedUrls: ["https://example.com/1", "https://example.com/1"],
      },
    },
  );

  expect(result.response.status).toBe(200);
  expect(receivedDraft).toEqual({
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      sourceMode: "catalog_only",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "solid",
      text: "",
      anchorItemRefs: [],
    },
    data: {
      wardrobe: {
        items: [{ url: "https://example.com/1" }],
        outfitSets: [],
        rawSelectionText: null,
        swimwearReasoning: null,
        swimwearRawSelectionText: null,
      },
      rejectedUrls: ["https://example.com/1"],
    },
    report,
  });
});

test("rejected urls patch rejects unknown urls and missing wardrobe", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const invalid = await requestJson(
    baseUrl,
    "/capsules/capsule-1/rejected-urls",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        rejectedUrls: ["https://example.com/unknown"],
      },
    },
  );

  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid_payload" });

  const noWardrobeServer = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "<New capsule>",
        draft: {
          filters: {
            formalityLevel: "casual",
            style: "minimalistic",
            sourceMode: "catalog_only",
            occasions: ["office"],
            season: ["spring"],
            audience: "woman",
            color: null,
            pattern: "solid",
            text: "",
          },
          data: {
            wardrobe: null,
            rejectedUrls: [],
          },
        },
        saved: null,
        status: "new",
      }),
    },
  });

  const notFound = await requestJson(
    noWardrobeServer.baseUrl,
    "/capsules/capsule-1/rejected-urls",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        rejectedUrls: ["https://example.com/1"],
      },
    },
  );

  expect(notFound.response.status).toBe(404);
  expect(notFound.json).toEqual({ error: "not_found" });
});

test("capsule mutation state and metadata routes map success and missing records", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      saveCapsuleImpl: async (_email, id) => {
        calls.push({ type: "save", id });
        return {
          id,
          name: "Saved",
          draft: null,
          saved: { filters: {}, data: {} },
          status: "saved",
        };
      },
      revertCapsuleImpl: async (_email, id) => {
        calls.push({ type: "revert", id });
        return {
          id,
          name: "Reverted",
          draft: null,
          saved: { filters: {}, data: {} },
          status: "saved",
        };
      },
      renameCapsuleImpl: async (_email, id, name) => {
        calls.push({ type: "rename", id, name });
        return { id, name, draft: null, saved: null, status: "new" };
      },
      setCapsulePinImpl: async (_email, id, pin) => {
        calls.push({ type: "pin", id, pin });
        return { id, pin, draft: null, saved: null, status: "new" };
      },
      duplicateCapsuleImpl: async (_email, id, name) => {
        calls.push({ type: "duplicate", id, name });
        return {
          id: "capsule-copy",
          name: name || "Copy",
          draft: null,
          saved: { filters: {}, data: {} },
          status: "saved",
        };
      },
      deleteCapsuleImpl: async (_email, id) => {
        calls.push({ type: "delete", id });
        return true;
      },
    },
  });

  const save = await requestJson(baseUrl, "/capsules/capsule-1/save", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(save.response.status).toBe(200);
  expect((save.json.capsule as { id?: string }).id).toBe("capsule-1");

  const revert = await requestJson(baseUrl, "/capsules/capsule-1/revert", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(revert.response.status).toBe(200);
  expect((revert.json.capsule as { name?: string }).name).toBe("Reverted");

  const rename = await requestJson(baseUrl, "/capsules/capsule-1/rename", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "Travel edit" },
  });
  expect(rename.response.status).toBe(200);
  expect((rename.json.capsule as { name?: string }).name).toBe("Travel edit");

  const pinned = await requestJson(baseUrl, "/capsules/capsule-1/pin", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { pin: true },
  });
  expect(pinned.response.status).toBe(200);
  expect((pinned.json.capsule as { pin?: boolean }).pin).toBe(true);

  const invalidPin = await requestJson(baseUrl, "/capsules/capsule-1/pin", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { pin: "true" },
  });
  expect(invalidPin.response.status).toBe(400);
  expect(invalidPin.json).toEqual({ error: "invalid_payload" });

  const invalidRename = await requestJson(
    baseUrl,
    "/capsules/capsule-1/rename",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { name: "  " },
    },
  );
  expect(invalidRename.response.status).toBe(400);
  expect(invalidRename.json).toEqual({ error: "invalid_payload" });

  const duplicate = await requestJson(
    baseUrl,
    "/capsules/capsule-1/duplicate",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { name: "Copy name" },
    },
  );
  expect(duplicate.response.status).toBe(201);
  expect((duplicate.json.capsule as { id?: string }).id).toBe("capsule-copy");

  const select = await requestJson(baseUrl, "/capsules/capsule-1/select", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(select.response.status).toBe(200);
  expect(select.json).toEqual({ ok: true, capsuleId: "capsule-1" });

  const deleted = await requestJson(baseUrl, "/capsules/capsule-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true });

  expect(calls).toEqual([
    { type: "save", id: "capsule-1" },
    { type: "revert", id: "capsule-1" },
    { type: "rename", id: "capsule-1", name: "Travel edit" },
    { type: "pin", id: "capsule-1", pin: true },
    { type: "duplicate", id: "capsule-1", name: "Copy name" },
    { type: "delete", id: "capsule-1" },
  ]);
});

test("capsule mutation routes map store failures and not-found responses", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const failingCreateServer = await startTestServer(t, {
    overrides: {
      createCapsuleImpl: async () => {
        throw new Error("create_failed");
      },
    },
  });
  const createFailure = await requestJson(
    failingCreateServer.baseUrl,
    "/capsules",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { name: "Spring edit", filters: {} },
    },
  );
  expect(createFailure.response.status).toBe(503);
  expect(createFailure.json).toEqual({ error: "service_unavailable" });

  const missingMutationsServer = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async () => null,
      saveCapsuleImpl: async () => null,
      revertCapsuleImpl: async () => null,
      renameCapsuleImpl: async () => null,
      setCapsulePinImpl: async () => null,
      duplicateCapsuleImpl: async () => null,
      getCapsuleImpl: async () => null,
      deleteCapsuleImpl: async () => false,
    },
  });
  const filtersMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/filters",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { filters: {} },
    },
  );
  expect(filtersMissing.response.status).toBe(404);
  expect(filtersMissing.json).toEqual({ error: "not_found" });

  const rejectedMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/rejected-urls",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { rejectedUrls: [] },
    },
  );
  expect(rejectedMissing.response.status).toBe(404);
  expect(rejectedMissing.json).toEqual({ error: "not_found" });

  const saveMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/save",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(saveMissing.response.status).toBe(404);
  expect(saveMissing.json).toEqual({ error: "not_found" });

  const revertMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/revert",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(revertMissing.response.status).toBe(404);
  expect(revertMissing.json).toEqual({ error: "not_found" });

  const renameMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/rename",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { name: "Travel edit" },
    },
  );
  expect(renameMissing.response.status).toBe(404);
  expect(renameMissing.json).toEqual({ error: "not_found" });

  const pinMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/pin",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { pin: true },
    },
  );
  expect(pinMissing.response.status).toBe(404);
  expect(pinMissing.json).toEqual({ error: "not_found" });

  const duplicateMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/duplicate",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(duplicateMissing.response.status).toBe(404);
  expect(duplicateMissing.json).toEqual({ error: "not_found" });

  const selectMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1/select",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(selectMissing.response.status).toBe(404);
  expect(selectMissing.json).toEqual({ error: "not_found" });

  const deleteMissing = await requestJson(
    missingMutationsServer.baseUrl,
    "/capsules/capsule-1",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(deleteMissing.response.status).toBe(404);
  expect(deleteMissing.json).toEqual({ error: "not_found" });
});

test("capsule pdf route maps missing inputs and build failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const noItemsServer = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({
        id: "capsule-1",
        name: "Empty",
        draft: null,
        saved: null,
        status: "new",
      }),
    },
  });
  const noItems = await requestJson(
    noItemsServer.baseUrl,
    "/capsules/capsule-1/pdf",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(noItems.response.status).toBe(404);
  expect(noItems.json).toEqual({ error: "not_found" });

  const noProductsServer = await startTestServer(t, {
    overrides: {
      getProductsByUrlsInOrderImpl: async () => [],
    },
  });
  const noProducts = await requestJson(
    noProductsServer.baseUrl,
    "/capsules/capsule-1/pdf",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(noProducts.response.status).toBe(404);
  expect(noProducts.json).toEqual({ error: "not_found" });

  const failingPdfServer = await startTestServer(t, {
    overrides: {
      buildWardrobePdfInChildImpl: async () => {
        throw new Error("pdf_failed");
      },
    },
  });
  const pdfFailure = await requestJson(
    failingPdfServer.baseUrl,
    "/capsules/capsule-1/pdf",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(pdfFailure.response.status).toBe(503);
  expect(pdfFailure.json).toEqual({ error: "service_unavailable" });
});
