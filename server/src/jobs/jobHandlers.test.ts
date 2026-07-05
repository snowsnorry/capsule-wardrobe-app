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
  const uploadSignal = new AbortController().signal;

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
    { signal: undefined },
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
    { signal: undefined },
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
    { signal: undefined },
  );

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "personalItemUploadUrls",
        payload: { urls: [" https://example.com/a.jpg ", "", null] },
      }),
      signal: uploadSignal,
      updateProgress,
    }),
  ).resolves.toEqual({ uploaded: 2 });
  expect(processQueuedWardrobeUrlUploadImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    signal: uploadSignal,
    urls: ["https://example.com/a.jpg"],
  });

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "personalItemUploadFiles",
        payload: { stagedFiles: [{ key: "staged/job-1/a.png" }] },
      }),
      signal: uploadSignal,
      updateProgress,
    }),
  ).resolves.toEqual({ uploaded: 1 });
  expect(processQueuedWardrobeFileUploadImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    stagedFiles: [{ key: "staged/job-1/a.png" }],
    signal: uploadSignal,
    filterItem: expect.any(Function),
  });

  expect(updateProgress).toHaveBeenCalledWith({
    phase: "running",
    current: 0,
    label: "Running",
  });
});

test("job handler dispatches capsule generation jobs directly with signal", async () => {
  const updateProgress = vi.fn(async () => {});
  const signal = new AbortController().signal;
  const runCapsuleGenerationJobImpl = vi.fn(async () => ({
    capsuleId: "capsule-1",
  }));
  const deps = {
    runCapsuleGenerationJobImpl,
  };

  await expect(
    runJobHandler(deps, {
      job: buildJob({
        kind: "capsuleGenerate",
        entityId: "capsule-1",
      }),
      signal,
      updateProgress,
    }),
  ).resolves.toEqual({ capsuleId: "capsule-1" });
  expect(runCapsuleGenerationJobImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      capsuleId: "capsule-1",
      email: "person@example.com",
      signal,
      updateProgress,
    }),
  );
});

test("job handler dispatches selected-regeneration and image jobs directly", async () => {
  const updateProgress = vi.fn(async () => {});
  const signal = new AbortController().signal;
  const runSelectedRegenerationJobImpl = vi.fn(async () => ({
    capsuleId: "capsule-1",
  }));
  const runOutfitImageGenerationJobImpl = vi.fn(async () => ({
    outfitId: "outfit-1",
  }));
  const runOutfitSetImageGenerationJobImpl = vi.fn(async () => ({
    capsuleId: "capsule-1",
    setIndex: 2,
  }));

  await expect(
    runJobHandler(
      { runSelectedRegenerationJobImpl },
      {
        job: buildJob({
          kind: "capsuleRegenerateSelected",
          entityId: "capsule-1",
          payload: { itemUrls: ["https://example.com/item"] },
        }),
        signal,
        updateProgress,
      },
    ),
  ).resolves.toEqual({ capsuleId: "capsule-1" });
  expect(runSelectedRegenerationJobImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      capsuleId: "capsule-1",
      email: "person@example.com",
      itemUrls: ["https://example.com/item"],
      signal,
    }),
  );

  await expect(
    runJobHandler(
      { runOutfitImageGenerationJobImpl },
      {
        job: buildJob({
          kind: "outfitImageGenerate",
          entityId: "outfit-1",
          payload: { outfitId: "outfit-1" },
        }),
        signal,
        updateProgress,
      },
    ),
  ).resolves.toEqual({ outfitId: "outfit-1" });

  await expect(
    runJobHandler(
      { runOutfitSetImageGenerationJobImpl },
      {
        job: buildJob({
          kind: "outfitSetImageGenerate",
          entityId: "capsule-1",
          payload: { capsuleId: "capsule-1", setIndex: 2 },
        }),
        signal,
        updateProgress,
      },
    ),
  ).resolves.toEqual({ capsuleId: "capsule-1", setIndex: 2 });
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
