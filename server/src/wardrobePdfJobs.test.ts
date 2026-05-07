import { test, expect, vi } from "vitest";
import { createWardrobePdfJobManager } from "./wardrobePdfJobs.js";
import {
  buildNormalizedProfileRecord,
  buildProductRow,
  buildProfileWithItems,
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
    },
  };
}

async function withMutedPdfLogs<T>(callback: () => Promise<T>): Promise<T> {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return await callback();
  } finally {
    error.mockRestore();
    warn.mockRestore();
  }
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
            { id: "top-1", category: "top", name: "A Top" },
          ],
        },
      }),
    }),
    getProfilePdfByEmail: async () => Buffer.from("stored-pdf"),
  });

  const res = createResponseRecorder();
  await manager.downloadWardrobePdf(
    {
      user: { email: "person@example.com" },
      body: { locale: "ru-RU" },
    },
    res,
  );

  expect(res.statusCode).toBe(200);
  expect(res.headers["Content-Type"]).toBe("application/pdf");
  expect(res.headers["Content-Disposition"]).toBe(
    'attachment; filename="capsule-wardrobe.pdf"',
  );
  expect(String(res.body)).toBe("stored-pdf");
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
            {
              id: "bag-1",
              url: "https://example.com/bag-1",
              category: "bag",
              name: "Bag",
            },
            {
              id: "top-2",
              url: "https://example.com/top-2",
              category: "top",
              name: "Z Top",
            },
            {
              id: "top-1",
              url: "https://example.com/top-1",
              category: "top",
              name: "A Top",
            },
          ],
        },
      }),
    }),
    getProfilePdfByEmail: async () => null,
    updateProfilePdfByEmail: async (_email, pdf) => {
      updatedPdf = pdf;
      return { email: _email };
    },
    getProducts: async (urls) => {
      receivedUrls = urls;
      return urls.map((url) =>
        buildProductRow({
          id: String(url),
          url: String(url),
          name: String(url),
          category: String(url).includes("bag") ? "bag" : "top",
          imageUrl: "",
        }),
      );
    },
    buildPdfInChild: async (products) =>
      Buffer.from(`pdf:${products.map((product) => product.id).join(",")}`),
  });

  const res = createResponseRecorder();
  await manager.downloadWardrobePdf(
    {
      user: { email: "person@example.com" },
      body: {},
    },
    res,
  );

  expect(res.statusCode).toBe(202);
  expect(res.body.status).toBe("pending");
  expect(res.body.pollAfterMs).toBe(2000);

  const job = manager.getWardrobePdfJob("person@example.com");
  expect(job).toBeTruthy();
  await job.promise;

  expect(receivedUrls).toEqual([
    "https://example.com/top-1",
    "https://example.com/top-2",
    "https://example.com/bag-1",
  ]);
  expect(String(updatedPdf)).toBe(
    "pdf:https://example.com/top-1,https://example.com/top-2,https://example.com/bag-1",
  );
});

test("ensureWardrobePdfJob reuses active pending job for same generation", async () => {
  let buildCount = 0;
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async () => ({
      ...buildNormalizedProfileRecord({ locale: "en" }),
      ...buildProfileWithItems({
        items: {
          items: [
            {
              id: "top-1",
              url: "https://example.com/top-1",
              category: "top",
              name: "A Top",
            },
          ],
        },
      }),
    }),
    getProducts: async (urls) =>
      urls.map((url) =>
        buildProductRow({
          id: String(url),
          url: String(url),
          name: String(url),
          category: "top",
          imageUrl: "",
        }),
      ),
    updateProfilePdfByEmail: async () => ({ email: "person@example.com" }),
    buildPdfInChild: async () => {
      buildCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Buffer.from("pdf");
    },
  });

  const first = await manager.ensureWardrobePdfJob("person@example.com", {
    wardrobePayload: {
      items: [
        {
          id: "top-1",
          url: "https://example.com/top-1",
          category: "top",
          name: "A Top",
        },
      ],
    },
    locale: "en",
  });
  const second = await manager.ensureWardrobePdfJob("person@example.com", {
    wardrobePayload: {
      items: [
        {
          id: "top-1",
          url: "https://example.com/top-1",
          category: "top",
          name: "A Top",
        },
      ],
    },
    locale: "en",
  });

  expect(first).toBe(second);
  await first.promise;
  expect(buildCount).toBe(1);
});

test("wardrobe pdf job fails for missing items or products", async () => {
  await withMutedPdfLogs(async () => {
    const missingItemsManager = createWardrobePdfJobManager({
      getProfileByEmail: async () =>
        buildNormalizedProfileRecord({ locale: "en" }),
      updateProfilePdfByEmail: async () => ({
        email: "missing-items@example.com",
      }),
      getProducts: async () => [],
      buildPdfInChild: async () => Buffer.from("pdf"),
    });
    const missingItemsJob = missingItemsManager.startWardrobePdfJob(
      "missing-items@example.com",
      {
        wardrobePayload: { items: [{ id: "top-1", category: "top" }] },
        locale: "en",
      },
    );
    await missingItemsJob.promise;
    expect(missingItemsJob.status).toBe("failed");
    expect((missingItemsJob.error as Error).message).toBe(
      "wardrobe_pdf_items_missing",
    );

    const missingProductsManager = createWardrobePdfJobManager({
      getProfileByEmail: async () =>
        buildNormalizedProfileRecord({ locale: "en" }),
      updateProfilePdfByEmail: async () => ({
        email: "missing-products@example.com",
      }),
      getProducts: async () => [],
      buildPdfInChild: async () => Buffer.from("pdf"),
    });
    const missingProductsJob = missingProductsManager.startWardrobePdfJob(
      "missing-products@example.com",
      {
        wardrobePayload: {
          items: [
            { id: "top-1", url: "https://example.com/top-1", category: "top" },
          ],
        },
        locale: "en",
      },
    );
    await missingProductsJob.promise;
    expect(missingProductsJob.status).toBe("failed");
    expect((missingProductsJob.error as Error).message).toBe(
      "wardrobe_pdf_products_missing",
    );
  });
});

test("ensureWardrobePdfJob returns null for missing profile or empty wardrobe and restarts failed jobs", async () => {
  let profileCalls = 0;
  const manager = createWardrobePdfJobManager({
    getProfileByEmail: async (email) => {
      profileCalls += 1;
      if (email === "missing-profile@example.com") {
        return null;
      }
      return {
        ...buildNormalizedProfileRecord({ locale: "en" }),
        ...buildProfileWithItems({ items: { items: [] } }),
      };
    },
    getProducts: async (urls) =>
      urls
        .filter((url) => String(url).includes("top-2"))
        .map((url) =>
          buildProductRow({
            id: String(url),
            url: String(url),
            name: String(url),
            category: "top",
            imageUrl: "",
          }),
        ),
    updateProfilePdfByEmail: async () => ({ email: "person@example.com" }),
    buildPdfInChild: async () => Buffer.from("pdf"),
  });

  await expect(
    manager.ensureWardrobePdfJob("missing-profile@example.com"),
  ).resolves.toBeNull();
  await expect(
    manager.ensureWardrobePdfJob("empty-profile@example.com"),
  ).resolves.toBeNull();
  expect(profileCalls).toBe(2);

  const failed = await withMutedPdfLogs(async () => {
    const job = manager.startWardrobePdfJob("restart-failed@example.com", {
      wardrobePayload: {
        items: [
          { id: "top-1", url: "https://example.com/top-1", category: "top" },
        ],
      },
      locale: "en",
    });
    await job.promise;
    return job;
  });
  expect(failed.status).toBe("failed");

  const restarted = await manager.ensureWardrobePdfJob(
    "restart-failed@example.com",
    {
      wardrobePayload: {
        items: [
          { id: "top-2", url: "https://example.com/top-2", category: "top" },
        ],
      },
      locale: "en",
    },
  );
  expect(restarted).not.toBe(failed);
  await restarted?.promise;
  expect(restarted?.status).toBe("completed");
});

test("downloadWardrobePdf returns not found for empty wardrobes and service unavailable on errors", async () => {
  const emptyManager = createWardrobePdfJobManager({
    getProfileWithPdfByEmail: async () => ({
      profile: {
        ...buildNormalizedProfileRecord({ locale: "en" }),
        ...buildProfileWithItems({ items: { items: [] } }),
      },
      pdf: null,
    }),
  });
  const emptyRes = createResponseRecorder();

  await emptyManager.downloadWardrobePdf(
    { user: { email: "empty@example.com" } },
    emptyRes,
  );

  expect(emptyRes.statusCode).toBe(404);
  expect(emptyRes.body).toEqual({ error: "not_found" });

  const failingManager = createWardrobePdfJobManager({
    getProfileWithPdfByEmail: async () => {
      throw new Error("db failed");
    },
  });
  const failingRes = createResponseRecorder();

  await withMutedPdfLogs(async () => {
    await failingManager.downloadWardrobePdf(
      { user: { email: "failing@example.com" } },
      failingRes,
    );
  });

  expect(failingRes.statusCode).toBe(503);
  expect(failingRes.body).toEqual({ error: "service_unavailable" });
});

test("completed pdf jobs expire from the in-memory registry", async () => {
  const manager = createWardrobePdfJobManager({
    getProducts: async (urls) =>
      urls.map((url) =>
        buildProductRow({
          id: String(url),
          url: String(url),
          name: String(url),
          category: "top",
          imageUrl: "",
        }),
      ),
    updateProfilePdfByEmail: async () => ({ email: "expiring@example.com" }),
    buildPdfInChild: async () => Buffer.from("pdf"),
  });
  const oldJob = {
    status: "completed",
    updatedAt: 0,
    startedAt: 0,
    generationKey: "old",
    error: null,
    promise: Promise.resolve(),
  };

  manager.startWardrobePdfJob("expiring@example.com", {
    wardrobePayload: {
      items: [
        { id: "top-1", url: "https://example.com/top-1", category: "top" },
      ],
    },
    locale: "en",
  });
  const current = manager.getWardrobePdfJob("expiring@example.com");
  Object.assign(current, oldJob);

  expect(manager.getWardrobePdfJob("expiring@example.com")).toBeNull();
});
