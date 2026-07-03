import { beforeEach, expect, test, vi } from "vitest";

const storeApi = vi.hoisted(() => ({
  claimPendingProviderJobs: vi.fn(),
  createPendingJob: vi.fn(),
  failJobRun: vi.fn(),
  setProviderJobId: vi.fn(),
}));

vi.mock("./jobStore.js", () => storeApi);

import { createJobQueue } from "./jobQueue.js";
import type { EnqueueJobInput, JobRunRecord, JobSnapshot } from "./types.js";

const input: EnqueueJobInput = {
  kind: "capsuleReportGenerate",
  profileEmail: "person@example.com",
  entity: { type: "capsule", id: "capsule-1" },
  dedupeKey: "report:capsule-1",
  payload: { capsuleId: "capsule-1" },
};

const job = {
  id: "job-1",
  kind: "capsuleReportGenerate",
  payload: { capsuleId: "capsule-1" },
} as unknown as JobRunRecord;

const snapshot = {
  id: "job-1",
  kind: "capsuleReportGenerate",
  status: "queued",
  entity: { type: "capsule", id: "capsule-1" },
} as JobSnapshot;

beforeEach(() => {
  storeApi.createPendingJob.mockReset();
  storeApi.claimPendingProviderJobs.mockReset();
  storeApi.failJobRun.mockReset();
  storeApi.setProviderJobId.mockReset();
});

test("job queue reconciles stale queued jobs without provider ids", async () => {
  const backend = {
    enqueue: vi.fn(async () => "provider-1"),
    start: vi.fn(),
    stop: vi.fn(),
  };
  storeApi.claimPendingProviderJobs.mockResolvedValueOnce([job]);

  await expect(
    createJobQueue({ backend }).reconcilePendingProviderJobs(),
  ).resolves.toEqual({ failed: 0, reenqueued: 1 });

  expect(storeApi.claimPendingProviderJobs).toHaveBeenCalledWith({
    staleMs: 30_000,
    limit: 25,
  });
  expect(backend.enqueue).toHaveBeenCalledWith({
    jobId: "job-1",
    kind: "capsuleReportGenerate",
    payload: { capsuleId: "capsule-1" },
  });
  expect(storeApi.setProviderJobId).toHaveBeenCalledWith("job-1", "provider-1");
});

test("job queue marks reconciled jobs failed when provider enqueue is unavailable", async () => {
  const backendError = new Error("provider_down");
  const backend = {
    enqueue: vi.fn(async () => {
      throw backendError;
    }),
    start: vi.fn(),
    stop: vi.fn(),
  };
  storeApi.claimPendingProviderJobs.mockResolvedValueOnce([job]);

  await expect(
    createJobQueue({ backend }).reconcilePendingProviderJobs(),
  ).resolves.toEqual({ failed: 1, reenqueued: 0 });

  expect(storeApi.failJobRun).toHaveBeenCalledWith({
    id: "job-1",
    errorCode: "queue_unavailable",
    errorMessage: "provider_down",
  });
});

test("job queue persists app-owned run before enqueuing provider work", async () => {
  const backend = {
    enqueue: vi.fn(async () => "provider-1"),
    start: vi.fn(),
    stop: vi.fn(),
  };
  storeApi.createPendingJob.mockResolvedValue({
    job,
    snapshot,
    deduped: false,
  });

  await expect(createJobQueue({ backend }).enqueue(input)).resolves.toBe(
    snapshot,
  );

  expect(storeApi.createPendingJob).toHaveBeenCalledWith(input);
  expect(backend.enqueue).toHaveBeenCalledWith({
    jobId: "job-1",
    kind: "capsuleReportGenerate",
    payload: { capsuleId: "capsule-1" },
  });
  expect(storeApi.setProviderJobId).toHaveBeenCalledWith("job-1", "provider-1");
});

test("job queue does not enqueue duplicate active jobs to the provider backend", async () => {
  const backend = {
    enqueue: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  storeApi.createPendingJob.mockResolvedValue({
    job,
    snapshot,
    deduped: true,
  });

  await expect(createJobQueue({ backend }).enqueue(input)).resolves.toBe(
    snapshot,
  );

  expect(backend.enqueue).not.toHaveBeenCalled();
  expect(storeApi.setProviderJobId).not.toHaveBeenCalled();
});

test("job queue marks the app-owned run failed when provider enqueue is unavailable", async () => {
  const backendError = new Error("provider_down");
  const backend = {
    enqueue: vi.fn(async () => {
      throw backendError;
    }),
    start: vi.fn(),
    stop: vi.fn(),
  };
  storeApi.createPendingJob.mockResolvedValue({
    job,
    snapshot,
    deduped: false,
  });

  await expect(createJobQueue({ backend }).enqueue(input)).rejects.toThrow(
    "provider_down",
  );

  expect(storeApi.failJobRun).toHaveBeenCalledWith({
    id: "job-1",
    errorCode: "queue_unavailable",
    errorMessage: "provider_down",
  });
});
