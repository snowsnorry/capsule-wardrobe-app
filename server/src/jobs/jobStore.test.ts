import { beforeEach, expect, test, vi } from "vitest";

const dbApi = vi.hoisted(() => ({
  claimQueuedJobRunsWithoutProviderId: vi.fn(),
  createJobRun: vi.fn(),
  getJobRunById: vi.fn(),
  getJobRunByIdForEmail: vi.fn(),
  listJobEventsAfter: vi.fn(),
  listJobRunsForEmail: vi.fn(),
  markJobRunCompleted: vi.fn(),
  markJobRunFailed: vi.fn(),
  markJobRunStarted: vi.fn(),
  setJobRunProviderJobId: vi.fn(),
  updateJobRunProgress: vi.fn(),
}));

vi.mock("../db.js", () => dbApi);

import {
  completeJobRun,
  claimPendingProviderJobs,
  createPendingJob,
  failJobRun,
  getJobForWorker,
  getOwnedJobSnapshot,
  listOwnedJobSnapshots,
  replayJobEvents,
  setProviderJobId,
  startJobRun,
  writeJobProgress,
} from "./jobStore.js";
import type { JobRunRecord } from "./types.js";

function jobRecord(overrides = {}) {
  return {
    id: "job-1",
    providerJobId: null,
    profileEmail: "person@example.com",
    kind: "capsuleReportGenerate",
    entityType: "capsule",
    entityId: "capsule-1",
    dedupeKey: "report:capsule-1",
    status: "queued",
    phase: "queued",
    progressCurrent: 0,
    progressTotal: null,
    progressLabel: null,
    payload: { capsuleId: "capsule-1" },
    result: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    ...overrides,
  } as JobRunRecord;
}

beforeEach(() => {
  for (const mock of Object.values(dbApi)) {
    mock.mockReset();
  }
});

test("createPendingJob returns snapshots for new and deduped jobs", async () => {
  const job = jobRecord();
  dbApi.createJobRun.mockResolvedValueOnce({ job, deduped: false });

  await expect(
    createPendingJob({
      kind: "capsuleReportGenerate",
      profileEmail: "person@example.com",
      entity: { type: "capsule", id: "capsule-1" },
      payload: { capsuleId: "capsule-1" },
    }),
  ).resolves.toMatchObject({
    deduped: false,
    snapshot: { id: "job-1", status: "queued" },
  });

  dbApi.createJobRun.mockResolvedValueOnce({ job, deduped: true });
  await expect(
    createPendingJob({
      kind: "capsuleReportGenerate",
      profileEmail: "person@example.com",
      payload: {},
    }),
  ).resolves.toMatchObject({
    deduped: true,
    snapshot: { id: "job-1", status: "queued" },
  });
});

test("jobStore claims stale providerless jobs for reconciliation", async () => {
  dbApi.claimQueuedJobRunsWithoutProviderId.mockResolvedValueOnce([
    jobRecord({ id: "job-1" }),
  ]);

  await expect(
    claimPendingProviderJobs({ staleMs: 30_000, limit: 25 }),
  ).resolves.toMatchObject([{ id: "job-1" }]);
  expect(dbApi.claimQueuedJobRunsWithoutProviderId).toHaveBeenCalledWith({
    staleMs: 30_000,
    limit: 25,
  });
});

test("createPendingJob does not write events outside the DB helper", async () => {
  dbApi.createJobRun.mockResolvedValueOnce({
    job: jobRecord(),
    deduped: false,
  });
  await createPendingJob({
    kind: "capsuleReportGenerate",
    profileEmail: "person@example.com",
    payload: {},
  });
});

test("jobStore maps owned and worker reads to public snapshots or raw worker rows", async () => {
  dbApi.setJobRunProviderJobId.mockResolvedValue(jobRecord());
  await expect(setProviderJobId("job-1", "provider-1")).resolves.toMatchObject({
    id: "job-1",
  });

  dbApi.getJobRunByIdForEmail.mockResolvedValueOnce(jobRecord());
  await expect(
    getOwnedJobSnapshot({ id: "job-1", email: "person@example.com" }),
  ).resolves.toMatchObject({ id: "job-1", entity: { type: "capsule" } });

  dbApi.getJobRunByIdForEmail.mockResolvedValueOnce(null);
  await expect(
    getOwnedJobSnapshot({ id: "missing", email: "person@example.com" }),
  ).resolves.toBeNull();

  dbApi.getJobRunById.mockResolvedValue(jobRecord());
  await expect(getJobForWorker("job-1")).resolves.toMatchObject({
    id: "job-1",
    payload: { capsuleId: "capsule-1" },
  });

  dbApi.listJobRunsForEmail.mockResolvedValue([
    jobRecord({ id: "job-1" }),
    jobRecord({ id: "job-2", status: "running" }),
  ]);
  await expect(
    listOwnedJobSnapshots({ email: "person@example.com", status: "active" }),
  ).resolves.toMatchObject([{ id: "job-1" }, { id: "job-2" }]);
});

test("jobStore delegates lifecycle updates to atomic DB helpers", async () => {
  dbApi.markJobRunStarted.mockResolvedValue(
    jobRecord({ status: "running", phase: "running" }),
  );
  await startJobRun("job-1");

  dbApi.updateJobRunProgress.mockResolvedValue(
    jobRecord({
      status: "running",
      phase: "uploading",
      progressCurrent: 1,
      progressTotal: 3,
    }),
  );
  await writeJobProgress({
    id: "job-1",
    phase: "uploading",
    current: 1,
    total: 3,
    label: "Uploading",
  });

  dbApi.markJobRunCompleted.mockResolvedValue(
    jobRecord({ status: "completed", result: { reportId: "report-1" } }),
  );
  await completeJobRun({ id: "job-1", result: { reportId: "report-1" } });

  dbApi.markJobRunFailed.mockResolvedValue(
    jobRecord({
      status: "failed",
      errorCode: "llm_failed",
      errorMessage: "No report",
    }),
  );
  await failJobRun({
    id: "job-1",
    errorCode: "llm_failed",
    errorMessage: "No report",
  });

  expect(
    dbApi.markJobRunStarted.mock.calls.length +
      dbApi.updateJobRunProgress.mock.calls.length +
      dbApi.markJobRunCompleted.mock.calls.length +
      dbApi.markJobRunFailed.mock.calls.length,
  ).toBe(4);
});

test("jobStore skips lifecycle events when updates do not find a job and replays raw events", async () => {
  dbApi.markJobRunStarted.mockResolvedValue(null);
  dbApi.updateJobRunProgress.mockResolvedValue(null);
  dbApi.markJobRunCompleted.mockResolvedValue(null);
  dbApi.markJobRunFailed.mockResolvedValue(null);

  await expect(startJobRun("missing")).resolves.toBeNull();
  await expect(writeJobProgress({ id: "missing" })).resolves.toBeNull();
  await expect(completeJobRun({ id: "missing" })).resolves.toBeNull();
  await expect(
    failJobRun({ id: "missing", errorCode: "not_found" }),
  ).resolves.toBeNull();
  dbApi.listJobEventsAfter.mockResolvedValue([
    { id: 2, jobId: "job-1", eventType: "complete", data: {}, createdAt: "" },
  ]);
  await expect(
    replayJobEvents({ jobId: "job-1", afterId: 1 }),
  ).resolves.toMatchObject([{ id: 2, eventType: "complete" }]);
});
