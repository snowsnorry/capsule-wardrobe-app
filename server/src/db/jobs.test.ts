import { beforeEach, expect, test, vi } from "vitest";

const coreApi = vi.hoisted(() => ({
  getSqlClient: vi.fn(),
  sql: vi.fn(),
}));
const stagedUploadStorageApi = vi.hoisted(() => ({
  cleanupStagedUploadFiles: vi.fn(async () => undefined),
}));

vi.mock("./core.js", () => ({
  getFirstRow: (rows: unknown) =>
    Array.isArray(rows) ? rows[0] || null : null,
  getSqlClient: coreApi.getSqlClient,
}));
vi.mock("../jobs/stagedUploadStorage.js", () => stagedUploadStorageApi);

import {
  appendJobEvent,
  clearJobRunsForEmail,
  createJobRun,
  getJobRunById,
  getJobRunByIdForEmail,
  listJobEventsAfter,
  listJobRunsForEmail,
  markJobRunCompleted,
  markJobRunFailed,
  markJobRunStarted,
  setJobRunProviderJobId,
  updateJobRunProgress,
} from "./jobs.js";

function jobRow(overrides = {}) {
  return {
    id: "job-1",
    provider_job_id: null,
    profile_email: "person@example.com",
    kind: "capsuleGenerate",
    entity_type: "capsule",
    entity_id: "capsule-1",
    dedupe_key: "capsule:1",
    status: "queued",
    phase: "queued",
    progress_current: "0",
    progress_total: null,
    progress_label: null,
    payload: '{"capsuleId":"capsule-1"}',
    result: null,
    error_code: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    ...overrides,
  };
}

function eventRow(overrides = {}) {
  return {
    id: "2",
    job_id: "job-1",
    event_type: "progress",
    data: '{"job":{"id":"job-1","status":"running"}}',
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  coreApi.sql.mockReset();
  coreApi.getSqlClient.mockReturnValue(coreApi.sql);
  stagedUploadStorageApi.cleanupStagedUploadFiles.mockClear();
});

test("createJobRun returns existing active dedupe job before inserting", async () => {
  coreApi.sql.mockResolvedValueOnce([jobRow()]);

  await expect(
    createJobRun({
      kind: "capsuleGenerate",
      profileEmail: " PERSON@Example.COM ",
      entity: { type: "capsule", id: "capsule-1" },
      dedupeKey: "capsule:1",
      payload: { capsuleId: "capsule-1" },
    }),
  ).resolves.toMatchObject({
    deduped: true,
    job: {
      id: "job-1",
      profileEmail: "person@example.com",
      payload: { capsuleId: "capsule-1" },
    },
  });
  expect(coreApi.sql).toHaveBeenCalledTimes(1);
});

test("createJobRun inserts queued jobs and recovers from unique active dedupe races", async () => {
  coreApi.sql
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([jobRow({ id: "job-2", payload: { ok: true } })]);

  await expect(
    createJobRun({
      kind: "personalItemsReportGenerate",
      profileEmail: "person@example.com",
      entity: { type: "wardrobe", id: null },
      dedupeKey: "report:wardrobe",
      progressTotal: 5,
      progressLabel: "Reporting",
      payload: { context: "office" },
    }),
  ).resolves.toMatchObject({
    deduped: false,
    job: { id: "job-2", payload: { ok: true } },
  });

  const uniqueViolation = new Error("23505 duplicate");
  (uniqueViolation as Error & { code?: string }).code = "23505";
  coreApi.sql
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(uniqueViolation)
    .mockResolvedValueOnce([jobRow({ id: "job-3" })]);

  await expect(
    createJobRun({
      kind: "capsuleGenerate",
      profileEmail: "person@example.com",
      dedupeKey: "capsule:1",
      payload: {},
    }),
  ).resolves.toMatchObject({ deduped: true, job: { id: "job-3" } });
});

test("job query helpers enforce ownership and status filtering", async () => {
  coreApi.sql.mockResolvedValueOnce([jobRow({ provider_job_id: "provider" })]);
  await expect(
    setJobRunProviderJobId({
      id: "job-1",
      providerJobId: "provider",
    }),
  ).resolves.toMatchObject({ providerJobId: "provider" });

  coreApi.sql.mockResolvedValueOnce([jobRow()]);
  await expect(
    getJobRunByIdForEmail({ id: "job-1", email: "PERSON@example.com" }),
  ).resolves.toMatchObject({ id: "job-1" });

  coreApi.sql.mockResolvedValueOnce([jobRow({ id: "worker-job" })]);
  await expect(getJobRunById("worker-job")).resolves.toMatchObject({
    id: "worker-job",
  });

  coreApi.sql.mockResolvedValueOnce([
    jobRow({ id: "running", status: "running" }),
  ]);
  await expect(
    listJobRunsForEmail({ email: "person@example.com", status: "active" }),
  ).resolves.toMatchObject([{ id: "running", status: "running" }]);

  coreApi.sql.mockResolvedValueOnce([
    jobRow({ id: "failed", status: "failed", payload: "not-json" }),
  ]);
  await expect(
    listJobRunsForEmail({ email: "person@example.com", status: "failed" }),
  ).resolves.toMatchObject([{ id: "failed", payload: {} }]);

  coreApi.sql.mockResolvedValueOnce([jobRow({ id: "any-status" })]);
  await expect(
    listJobRunsForEmail({ email: "person@example.com" }),
  ).resolves.toMatchObject([{ id: "any-status" }]);
});

test("job mutation helpers update lifecycle state and parse nullable JSON objects", async () => {
  coreApi.sql.mockResolvedValueOnce([
    jobRow({
      status: "running",
      started_at: new Date("2026-01-01T00:00:00.000Z"),
    }),
  ]);
  await expect(markJobRunStarted("job-1")).resolves.toMatchObject({
    status: "running",
    startedAt: "2026-01-01T00:00:00.000Z",
  });

  coreApi.sql.mockResolvedValueOnce([
    jobRow({
      phase: "uploading",
      progress_current: 2,
      progress_total: 4,
      progress_label: "Uploading",
    }),
  ]);
  await expect(
    updateJobRunProgress({
      id: "job-1",
      phase: "uploading",
      current: 2,
      total: 4,
      label: "Uploading",
    }),
  ).resolves.toMatchObject({
    phase: "uploading",
    progressCurrent: 2,
    progressTotal: 4,
    progressLabel: "Uploading",
  });

  coreApi.sql.mockResolvedValueOnce([
    jobRow({
      status: "completed",
      result: '{"items":2}',
      completed_at: "2026-01-01T00:01:00.000Z",
    }),
  ]);
  await expect(
    markJobRunCompleted({ id: "job-1", result: { items: 2 } }),
  ).resolves.toMatchObject({
    status: "completed",
    result: { items: 2 },
  });

  coreApi.sql.mockResolvedValueOnce([
    jobRow({
      status: "failed",
      result: "[]",
      error_code: "llm_failed",
      error_message: "No result",
      failed_at: "2026-01-01T00:02:00.000Z",
    }),
  ]);
  await expect(
    markJobRunFailed({
      id: "job-1",
      errorCode: "llm_failed",
      errorMessage: "No result",
    }),
  ).resolves.toMatchObject({
    status: "failed",
    result: null,
    errorCode: "llm_failed",
  });
});

test("job event helpers append replayable events and cleanup profile-owned rows", async () => {
  coreApi.sql.mockResolvedValueOnce([eventRow()]);
  await expect(
    appendJobEvent({
      jobId: "job-1",
      eventType: "progress",
      data: { job: { id: "job-1" } },
    }),
  ).resolves.toEqual({
    id: 2,
    jobId: "job-1",
    eventType: "progress",
    data: { job: { id: "job-1", status: "running" } },
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  coreApi.sql.mockResolvedValueOnce([eventRow({ id: 3 })]);
  await expect(
    listJobEventsAfter({ jobId: "job-1", afterId: 2 }),
  ).resolves.toMatchObject([{ id: 3, jobId: "job-1" }]);

  coreApi.sql.mockResolvedValueOnce([
    {
      id: "job-1",
      payload: JSON.stringify({
        stagedFiles: [
          {
            storage: "local",
            key: "/tmp/staged.png",
            mimeType: "image/png",
            originalName: "source.png",
          },
        ],
      }),
    },
    { id: "job-2", payload: "{}" },
  ]);
  await expect(clearJobRunsForEmail("PERSON@example.com")).resolves.toBe(2);
  expect(stagedUploadStorageApi.cleanupStagedUploadFiles).toHaveBeenCalledWith([
    {
      storage: "local",
      key: "/tmp/staged.png",
      mimeType: "image/png",
      originalName: "source.png",
    },
  ]);
});
