import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

test("capsule action routes cover wardrobe handlers and pdf download", async (t) => {
  let wardrobeCalled = false;
  let fullRegenerateCalled = false;
  let regenerateCalled = false;
  let pdfLocale = null;
  let pdfProducts = null;

  const { baseUrl } = await startTestServer(t, {
    overrides: {
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
      buildWardrobePdfInChildImpl: async (products, locale) => {
        pdfProducts = products;
        pdfLocale = locale;
        return Buffer.from("pdf");
      },
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
  expect(fullRegenerateCalled).toBe(true);

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
  expect(regenerate.response.status).toBe(200);
  expect(regenerateCalled).toBe(true);

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
  expect(outfitSetImage.response.status).toBe(202);
  expect(outfitSetImage.json).toEqual({ ok: true, status: "pending" });

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
  expect(pdfProducts).toHaveLength(1);
  expect(pdfProducts?.[0]).toMatchObject({ url: "https://example.com/1" });
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
                  id: "W7",
                  itemSource: "wardrobe",
                  wardrobeId: "7",
                  url: "wardrobe://7",
                  name: "Snapshot uploaded shirt",
                  imageUrl: "https://images.example.com/snapshot.webp",
                  source: "uploaded",
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
        anchorWardrobeItemIds: [],
      },
      data: {
        wardrobe: null,
        rejectedUrls: [],
      },
    },
    saved: null,
    setActive: true,
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
      anchorWardrobeItemIds: [],
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

test("filters patch normalizes and validates anchor wardrobe ids", async (t) => {
  let receivedAnchorIds = null;
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      validateCapsuleAnchorItemsImpl: async (_email, anchorIds) => {
        receivedAnchorIds = anchorIds;
        return {
          anchorWardrobeItemIds: ["W12", "W18"],
          anchorWardrobeNumericIds: [12, 18],
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
        anchorWardrobeItemIds: ["w12", "W18"],
      },
    },
  });

  expect(result.response.status).toBe(200);
  expect(receivedAnchorIds).toEqual(["W12", "W18"]);
  expect(receivedDraft?.filters.anchorWardrobeItemIds).toEqual(["W12", "W18"]);
});

test("filters patch rejects invalid anchor wardrobe ids", async (t) => {
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
        anchorWardrobeItemIds: ["not-a-wardrobe-id"],
      },
    },
  });

  expect(result.response.status).toBe(400);
  expect(result.json).toEqual({ error: "invalid_payload" });
});

test("filters patch can trigger regenerate via query flag after saving filters", async (t) => {
  const calls = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        calls.push({ type: "update", draft });
        return { id: "capsule-1", draft, saved: null, status: "new" };
      },
      regenerateCapsuleWardrobeHandler: async (req, res) => {
        calls.push({ type: "regenerate", query: req.query });
        return res.status(202).json({ ok: true, status: "pending" });
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
          anchorWardrobeItemIds: [],
        },
        data: {
          wardrobe: null,
          rejectedUrls: [],
        },
      },
    },
    {
      type: "regenerate",
      query: {
        regenerate: "true",
      },
    },
  ]);
});

test("rejected urls patch validates against current capsule wardrobe", async (t) => {
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
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
      anchorWardrobeItemIds: [],
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
      updateProfileActiveCapsuleIdImpl: async (_email, activeCapsuleId) => {
        calls.push({ type: "select", activeCapsuleId });
        return { activeCapsuleId };
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
  expect(select.json.activeCapsuleId).toBe("capsule-1");

  const deleted = await requestJson(baseUrl, "/capsules/capsule-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(deleted.response.status).toBe(200);
  expect((deleted.json.activeCapsule as { id?: string }).id).toBe("capsule-1");

  expect(calls).toEqual([
    { type: "save", id: "capsule-1" },
    { type: "revert", id: "capsule-1" },
    { type: "rename", id: "capsule-1", name: "Travel edit" },
    { type: "duplicate", id: "capsule-1", name: "Copy name" },
    { type: "select", activeCapsuleId: "capsule-1" },
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
