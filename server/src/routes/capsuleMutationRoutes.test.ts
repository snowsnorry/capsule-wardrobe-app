import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_COOKIE, CSRF_TOKEN, TEST_CLIENT_ORIGIN, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("capsule action routes cover wardrobe handlers and pdf download", async (t) => {
  let wardrobeCalled = false;
  let fullRegenerateCalled = false;
  let regenerateCalled = false;
  let pdfLocale = null;

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
      buildWardrobePdfInChildImpl: async (_products, locale) => {
        pdfLocale = locale;
        return Buffer.from("pdf");
      }
    }
  });

  const wardrobe = await requestJson(baseUrl, "/capsules/capsule-1/events", {
    cookie: AUTH_COOKIE
  });
  assert.equal(wardrobe.response.status, 200);
  assert.equal(wardrobeCalled, true);
  assert.equal(wardrobe.json.snapshot.status, "ready");

  const fullRegenerate = await requestJson(baseUrl, "/capsules/capsule-1/regenerate", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(fullRegenerate.response.status, 202);
  assert.equal(fullRegenerateCalled, true);

  const regenerate = await requestJson(baseUrl, "/capsules/capsule-1/regenerate-selected", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { itemUrls: ["https://example.com/1"] }
  });
  assert.equal(regenerate.response.status, 200);
  assert.equal(regenerateCalled, true);

  const outfitSetImage = await requestJson(baseUrl, "/capsules/capsule-1/outfit-sets/0/image", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(outfitSetImage.response.status, 202);
  assert.deepEqual(outfitSetImage.json, { ok: true, status: "pending" });

  const removedWardrobeRoute = await requestJson(baseUrl, "/capsules/capsule-1/items", {
    cookie: AUTH_COOKIE
  });
  assert.equal(removedWardrobeRoute.response.status, 404);

  const pdf = await requestJson(baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(pdf.response.status, 200);
  assert.equal(pdfLocale, "en");
  assert.equal(
    pdf.response.headers.get("content-disposition"),
    `attachment; filename="New-capsule.pdf"; filename*=UTF-8''${encodeURIComponent("New capsule.pdf")}`
  );
});

test("capsule creation only accepts name and filters and initializes server-owned data", async (t) => {
  let receivedPayload = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      createCapsuleImpl: async (_email, payload) => {
        receivedPayload = payload;
        return { id: "capsule-2", draft: payload.draft, saved: null, status: "new" };
      }
    }
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
        occasions: ["office", "", null],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped"
      }
    }
  });

  assert.equal(result.response.status, 201);
  assert.deepEqual(receivedPayload, {
    name: "Spring edit",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
        text: ""
      },
      data: {
        wardrobe: null,
        rejectedUrls: []
      }
    },
    saved: null,
    setActive: true
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
      draft: {
        filters: { audience: "woman" },
        data: {
          wardrobe: { items: [{ url: "https://malicious.example/item" }] },
          rejectedUrls: ["https://malicious.example/rejected"]
        }
      }
    }
  });

  assert.equal(result.response.status, 400);
  assert.deepEqual(result.json, { error: "invalid_payload" });
});

test("filters patch only accepts filters and resets draft data", async (t) => {
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      }
    }
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
        occasions: ["office", "", null],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
        text: "  Prefer natural fabrics  ",
        ignoredField: "ignored"
      }
    }
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(receivedDraft, {
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: "red",
      pattern: "striped",
      text: "Prefer natural fabrics"
    },
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  });
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
      }
    }
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/filters?regenerate=true", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      filters: {
        audience: "woman",
        season: ["summer"]
      }
    }
  });

  assert.equal(result.response.status, 202);
  assert.deepEqual(calls, [
    {
      type: "update",
      draft: {
        filters: {
          formalityLevel: "",
          style: null,
          occasions: [],
          audience: "woman",
          season: ["summer"],
          color: null,
          pattern: "solid",
          text: ""
        },
        data: {
          wardrobe: null,
          rejectedUrls: []
        }
      }
    },
    {
      type: "regenerate",
      query: {
        regenerate: "true"
      }
    }
  ]);
});

test("rejected urls patch validates against current capsule wardrobe", async (t) => {
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      }
    }
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      rejectedUrls: ["https://example.com/1", "https://example.com/1"]
    }
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(receivedDraft, {
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "solid",
      text: ""
    },
    data: {
      wardrobe: {
        items: [{ url: "https://example.com/1" }],
        outfitSets: [],
        rawSelectionText: null,
        swimwearReasoning: null,
        swimwearRawSelectionText: null
      },
      rejectedUrls: ["https://example.com/1"]
    }
  });
});

test("rejected urls patch rejects unknown urls and missing wardrobe", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const invalid = await requestJson(baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      rejectedUrls: ["https://example.com/unknown"]
    }
  });

  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.json, { error: "invalid_payload" });

  const noWardrobeServer = await startTestServer(t, {
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
            text: ""
          },
          data: {
            wardrobe: null,
            rejectedUrls: []
          }
        },
        saved: null,
        status: "new"
      })
    }
  });

  const notFound = await requestJson(noWardrobeServer.baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      rejectedUrls: ["https://example.com/1"]
    }
  });

  assert.equal(notFound.response.status, 404);
  assert.deepEqual(notFound.json, { error: "not_found" });
});

test("capsule mutation state and metadata routes map success and missing records", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      saveCapsuleImpl: async (_email, id) => {
        calls.push({ type: "save", id });
        return { id, name: "Saved", draft: null, saved: { filters: {}, data: {} }, status: "saved" };
      },
      revertCapsuleImpl: async (_email, id) => {
        calls.push({ type: "revert", id });
        return { id, name: "Reverted", draft: null, saved: { filters: {}, data: {} }, status: "saved" };
      },
      renameCapsuleImpl: async (_email, id, name) => {
        calls.push({ type: "rename", id, name });
        return { id, name, draft: null, saved: null, status: "new" };
      },
      duplicateCapsuleImpl: async (_email, id, name) => {
        calls.push({ type: "duplicate", id, name });
        return { id: "capsule-copy", name: name || "Copy", draft: null, saved: { filters: {}, data: {} }, status: "saved" };
      },
      updateProfileActiveCapsuleIdImpl: async (_email, activeCapsuleId) => {
        calls.push({ type: "select", activeCapsuleId });
        return { activeCapsuleId };
      },
      deleteCapsuleImpl: async (_email, id) => {
        calls.push({ type: "delete", id });
        return true;
      }
    }
  });

  const save = await requestJson(baseUrl, "/capsules/capsule-1/save", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(save.response.status, 200);
  assert.equal((save.json.capsule as { id?: string }).id, "capsule-1");

  const revert = await requestJson(baseUrl, "/capsules/capsule-1/revert", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(revert.response.status, 200);
  assert.equal((revert.json.capsule as { name?: string }).name, "Reverted");

  const rename = await requestJson(baseUrl, "/capsules/capsule-1/rename", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "Travel edit" }
  });
  assert.equal(rename.response.status, 200);
  assert.equal((rename.json.capsule as { name?: string }).name, "Travel edit");

  const invalidRename = await requestJson(baseUrl, "/capsules/capsule-1/rename", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "  " }
  });
  assert.equal(invalidRename.response.status, 400);
  assert.deepEqual(invalidRename.json, { error: "invalid_payload" });

  const duplicate = await requestJson(baseUrl, "/capsules/capsule-1/duplicate", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "Copy name" }
  });
  assert.equal(duplicate.response.status, 201);
  assert.equal((duplicate.json.capsule as { id?: string }).id, "capsule-copy");

  const select = await requestJson(baseUrl, "/capsules/capsule-1/select", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(select.response.status, 200);
  assert.equal(select.json.activeCapsuleId, "capsule-1");

  const deleted = await requestJson(baseUrl, "/capsules/capsule-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(deleted.response.status, 200);
  assert.equal((deleted.json.activeCapsule as { id?: string }).id, "capsule-1");

  assert.deepEqual(calls, [
    { type: "save", id: "capsule-1" },
    { type: "revert", id: "capsule-1" },
    { type: "rename", id: "capsule-1", name: "Travel edit" },
    { type: "duplicate", id: "capsule-1", name: "Copy name" },
    { type: "select", activeCapsuleId: "capsule-1" },
    { type: "delete", id: "capsule-1" }
  ]);
});

test("capsule mutation routes map store failures and not-found responses", async (t) => {
  t.mock.method(console, "error", () => {});

  const failingCreateServer = await startTestServer(t, {
    overrides: {
      createCapsuleImpl: async () => {
        throw new Error("create_failed");
      }
    }
  });
  const createFailure = await requestJson(failingCreateServer.baseUrl, "/capsules", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "Spring edit", filters: {} }
  });
  assert.equal(createFailure.response.status, 503);
  assert.deepEqual(createFailure.json, { error: "service_unavailable" });

  const missingMutationsServer = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async () => null,
      saveCapsuleImpl: async () => null,
      revertCapsuleImpl: async () => null,
      renameCapsuleImpl: async () => null,
      duplicateCapsuleImpl: async () => null,
      getCapsuleImpl: async () => null,
      deleteCapsuleImpl: async () => false
    }
  });
  const filtersMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/filters", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { filters: {} }
  });
  assert.equal(filtersMissing.response.status, 404);
  assert.deepEqual(filtersMissing.json, { error: "not_found" });

  const rejectedMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { rejectedUrls: [] }
  });
  assert.equal(rejectedMissing.response.status, 404);
  assert.deepEqual(rejectedMissing.json, { error: "not_found" });

  const saveMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/save", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(saveMissing.response.status, 404);
  assert.deepEqual(saveMissing.json, { error: "not_found" });

  const revertMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/revert", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(revertMissing.response.status, 404);
  assert.deepEqual(revertMissing.json, { error: "not_found" });

  const renameMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/rename", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { name: "Travel edit" }
  });
  assert.equal(renameMissing.response.status, 404);
  assert.deepEqual(renameMissing.json, { error: "not_found" });

  const duplicateMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/duplicate", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(duplicateMissing.response.status, 404);
  assert.deepEqual(duplicateMissing.json, { error: "not_found" });

  const selectMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1/select", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(selectMissing.response.status, 404);
  assert.deepEqual(selectMissing.json, { error: "not_found" });

  const deleteMissing = await requestJson(missingMutationsServer.baseUrl, "/capsules/capsule-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(deleteMissing.response.status, 404);
  assert.deepEqual(deleteMissing.json, { error: "not_found" });
});

test("capsule pdf route maps missing inputs and build failures", async (t) => {
  t.mock.method(console, "error", () => {});

  const noItemsServer = await startTestServer(t, {
    overrides: {
      getCapsuleImpl: async () => ({ id: "capsule-1", name: "Empty", draft: null, saved: null, status: "new" })
    }
  });
  const noItems = await requestJson(noItemsServer.baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(noItems.response.status, 404);
  assert.deepEqual(noItems.json, { error: "not_found" });

  const noProductsServer = await startTestServer(t, {
    overrides: {
      getProductsByUrlsInOrderImpl: async () => []
    }
  });
  const noProducts = await requestJson(noProductsServer.baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(noProducts.response.status, 404);
  assert.deepEqual(noProducts.json, { error: "not_found" });

  const failingPdfServer = await startTestServer(t, {
    overrides: {
      buildWardrobePdfInChildImpl: async () => {
        throw new Error("pdf_failed");
      }
    }
  });
  const pdfFailure = await requestJson(failingPdfServer.baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(pdfFailure.response.status, 503);
  assert.deepEqual(pdfFailure.json, { error: "service_unavailable" });
});
