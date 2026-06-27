import { expect, test, vi } from "vitest";
import { runJobHandler } from "./jobHandlers.js";
import type { JobKind, JobRunRecord } from "./types.js";

function buildJob(
  overrides: Partial<JobRunRecord> & { kind: JobKind },
): JobRunRecord {
  return {
    id: "job-1",
    providerJobId: null,
    profileEmail: "person@example.com",
    kind: overrides.kind,
    entityType: null,
    entityId: null,
    dedupeKey: null,
    status: "running",
    phase: "running",
    progressCurrent: 0,
    progressTotal: null,
    progressLabel: null,
    payload: {},
    result: null,
    errorCode: null,
    errorMessage: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    failedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    ...overrides,
  };
}

test("job handler dispatches report and upload jobs to worker dependencies", async () => {
  const updateProgress = vi.fn(async () => {});
  const generateCapsuleReportImpl = vi.fn(async () => ({ id: "report-1" }));
  const generateOutfitReportImpl = vi.fn(async () => ({ id: "outfit-report" }));
  const generatePersonalItemsReportImpl = vi.fn(async () => ({
    id: "personal-report",
  }));
  const processQueuedWardrobeUrlUploadImpl = vi.fn(async () => ({
    uploaded: 2,
  }));
  const processQueuedWardrobeFileUploadImpl = vi.fn(async () => ({
    uploaded: 1,
  }));
  const deps = {
    generateCapsuleReportImpl,
    generateOutfitReportImpl,
    generatePersonalItemsReportImpl,
    processQueuedWardrobeUrlUploadImpl,
    processQueuedWardrobeFileUploadImpl,
  };

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "capsuleReportGenerate",
        entityId: "capsule-1",
      }),
      updateProgress,
    }),
  ).resolves.toEqual({ report: { id: "report-1" } });
  expect(generateCapsuleReportImpl).toHaveBeenCalledWith(
    "person@example.com",
    "capsule-1",
  );

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "outfitReportGenerate",
        payload: { outfitId: "outfit-1" },
      }),
      updateProgress,
    }),
  ).resolves.toEqual({ report: { id: "outfit-report" } });
  expect(generateOutfitReportImpl).toHaveBeenCalledWith(
    "person@example.com",
    "outfit-1",
  );

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "personalItemsReportGenerate",
        payload: { context: "office" },
      }),
      updateProgress,
    }),
  ).resolves.toEqual({ id: "personal-report" });
  expect(generatePersonalItemsReportImpl).toHaveBeenCalledWith(
    "person@example.com",
    "office",
  );

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "personalItemUploadUrls",
        payload: { urls: [" https://example.com/a.jpg ", "", null] },
      }),
      updateProgress,
    }),
  ).resolves.toEqual({ uploaded: 2 });
  expect(processQueuedWardrobeUrlUploadImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    urls: ["https://example.com/a.jpg"],
  });

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "personalItemUploadFiles",
        payload: { stagedFiles: [{ key: "staged/job-1/a.png" }] },
      }),
      updateProgress,
    }),
  ).resolves.toEqual({ uploaded: 1 });
  expect(processQueuedWardrobeFileUploadImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    stagedFiles: [{ key: "staged/job-1/a.png" }],
    filterItem: expect.any(Function),
  });

  expect(updateProgress).toHaveBeenCalledWith({
    phase: "running",
    current: 0,
    label: "Running",
  });
});

test("job handler normalizes legacy job failures into error codes", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const updateProgress = vi.fn(async () => {});
  const failure = new Error("legacy_failed");
  const regenerateCapsuleWardrobeHandler = vi.fn(async (_req, res) => {
    (res as { json: (body: unknown) => unknown }).json({
      ok: true,
      status: "pending",
    });
  });
  const deps = {
    regenerateCapsuleWardrobeHandler,
    getWardrobeJobImpl: () => ({
      error: failure,
      status: "failed",
    }),
  };

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "capsuleGenerate",
        entityId: "capsule-1",
      }),
      updateProgress,
    }),
  ).rejects.toMatchObject({
    code: "legacy_failed",
    message: "legacy_failed",
  });
  expect(regenerateCapsuleWardrobeHandler).toHaveBeenCalledWith(
    expect.objectContaining({
      params: { id: "capsule-1" },
      user: { email: "person@example.com" },
    }),
    expect.any(Object),
  );
});

test("job handler waits for selected-regeneration legacy jobs and maps handler errors", async () => {
  const updateProgress = vi.fn(async () => {});
  const regenerateSelectedCapsuleItemsHandler = vi.fn(async (_req, res) => {
    (res as { status: (code: number) => { json: (body: unknown) => void } })
      .status(400)
      .json({ error: "invalid_payload" });
  });

  await expect(
    runJobHandler(
      { regenerateSelectedCapsuleItemsHandler },
      {
        job: buildJob({
          kind: "capsuleRegenerateSelected",
          entityId: "capsule-1",
          payload: { itemUrls: ["https://example.com/item"] },
        }),
        updateProgress,
      },
    ),
  ).rejects.toMatchObject({
    code: "invalid_payload",
    message: "invalid_payload",
  });
  expect(regenerateSelectedCapsuleItemsHandler).toHaveBeenCalledWith(
    expect.objectContaining({
      body: { itemUrls: ["https://example.com/item"] },
      params: { id: "capsule-1" },
      user: { email: "person@example.com" },
    }),
    expect.any(Object),
  );

  const successfulHandler = vi.fn(async (_req, res) => {
    (res as { json: (body: unknown) => void }).json({ ok: true });
  });
  await expect(
    runJobHandler(
      {
        regenerateSelectedCapsuleItemsHandler: successfulHandler,
        getPartialRegenerationJobImpl: () => ({
          promise: Promise.resolve(),
          status: "completed",
        }),
      },
      {
        job: buildJob({
          kind: "capsuleRegenerateSelected",
          payload: { capsuleId: "capsule-1", itemUrls: "not-an-array" },
        }),
        updateProgress,
      },
    ),
  ).resolves.toEqual({});
});

test("job handler rejects missing handlers and unsupported kinds with stable codes", async () => {
  const updateProgress = vi.fn(async () => {});

  await expect(
    runJobHandler(
      {},
      {
        job: buildJob({ kind: "capsuleGenerate" }),
        updateProgress,
      },
    ),
  ).rejects.toMatchObject({
    code: "capsule_generation_handler_missing",
  });

  await expect(
    runJobHandler(
      {},
      {
        job: buildJob({
          kind: "personalItemUploadUrls",
          payload: { urls: ["https://example.com/item.png"] },
        }),
        updateProgress,
      },
    ),
  ).rejects.toMatchObject({
    code: "wardrobe_url_upload_handler_missing",
  });

  await expect(
    runJobHandler(
      {},
      {
        job: buildJob({
          kind: "unsupported" as JobKind,
        }),
        updateProgress,
      },
    ),
  ).rejects.toMatchObject({
    code: "unsupported_job_kind",
  });
});
