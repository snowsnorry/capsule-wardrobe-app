import test from "node:test";
import assert from "node:assert/strict";
import { createWardrobePdfJobManager } from "./wardrobePdfJobs.js";
import {
  buildNormalizedProfileRecord,
  buildProductRow,
  buildProfileWithItems
} from "./test/domainFixtures.js";

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("wardrobe pdf endpoint returns stored attachment when pdf already exists", async () => {
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      ...buildNormalizedProfileRecord({ locale: "ru" }),
      ...buildProfileWithItems({
        items: {
          items: [
            { id: "bag-1", category: "bag", name: "B Bag" },
            { id: "top-2", category: "top", name: "Z Top" },
            { id: "top-1", category: "top", name: "A Top" }
          ]
        }
      })
    }),
    getProfilePdfByEmail: async () => Buffer.from("stored-pdf")
  });

  const res = createResponseRecorder();
  await manager.downloadWardrobePdf(
    {
      user: { email: "person@example.com" },
      body: { locale: "ru-RU" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.equal(res.headers["Content-Disposition"], 'attachment; filename="capsule-wardrobe.pdf"');
  assert.equal(String(res.body), "stored-pdf");
});

test("wardrobe pdf endpoint returns pending and starts job when pdf is missing", async () => {
  let updatedPdf = null;
  let receivedUrls = null;
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      ...buildNormalizedProfileRecord({ locale: "en" }),
      ...buildProfileWithItems({
        items: {
          items: [
            { id: "bag-1", url: "https://example.com/bag-1", category: "bag", name: "Bag" },
            { id: "top-2", url: "https://example.com/top-2", category: "top", name: "Z Top" },
            { id: "top-1", url: "https://example.com/top-1", category: "top", name: "A Top" }
          ]
        }
      })
    }),
    getProfilePdfByEmail: async () => null,
    updateProfilePdfByEmail: async (_email, pdf) => {
      updatedPdf = pdf;
      return { email: _email };
    },
    getProducts: async (urls) => {
      receivedUrls = urls;
      return urls.map((url) => buildProductRow({
        id: String(url),
        url: String(url),
        name: String(url),
        category: String(url).includes("bag") ? "bag" : "top",
        imageUrl: ""
      }));
    },
    buildPdfInChild: async (products) => Buffer.from(`pdf:${products.map((product) => product.id).join(",")}`)
  });

  const res = createResponseRecorder();
  await manager.downloadWardrobePdf(
    {
      user: { email: "person@example.com" },
      body: {}
    },
    res
  );

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.status, "pending");
  assert.equal(res.body.pollAfterMs, 2000);

  const job = manager.getWardrobePdfJob("person@example.com");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(receivedUrls, ["https://example.com/top-1", "https://example.com/top-2", "https://example.com/bag-1"]);
  assert.equal(String(updatedPdf), "pdf:https://example.com/top-1,https://example.com/top-2,https://example.com/bag-1");
});

test("ensureWardrobePdfJob reuses active pending job for same generation", async () => {
  let buildCount = 0;
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      ...buildNormalizedProfileRecord({ locale: "en" }),
      ...buildProfileWithItems({
        items: {
          items: [{ id: "top-1", url: "https://example.com/top-1", category: "top", name: "A Top" }]
        }
      })
    }),
    getProducts: async (urls) => urls.map((url) => buildProductRow({
      id: String(url),
      url: String(url),
      name: String(url),
      category: "top",
      imageUrl: ""
    })),
    updateProfilePdfByEmail: async () => ({ email: "person@example.com" }),
    buildPdfInChild: async () => {
      buildCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Buffer.from("pdf");
    }
  });

  const first = await manager.ensureWardrobePdfJob("person@example.com", {
    wardrobePayload: {
      items: [{ id: "top-1", url: "https://example.com/top-1", category: "top", name: "A Top" }]
    },
    locale: "en"
  });
  const second = await manager.ensureWardrobePdfJob("person@example.com", {
    wardrobePayload: {
      items: [{ id: "top-1", url: "https://example.com/top-1", category: "top", name: "A Top" }]
    },
    locale: "en"
  });

  assert.equal(first, second);
  await first.promise;
  assert.equal(buildCount, 1);
});
