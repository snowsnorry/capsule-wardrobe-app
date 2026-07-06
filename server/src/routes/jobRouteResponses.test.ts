import { expect, test, vi } from "vitest";
import {
  enqueueRouteJob,
  sendJobEnqueueError,
  sendQueuedJob,
} from "./jobRouteResponses.js";
import type { JobSnapshot } from "../jobs/types.js";

const snapshot = {
  id: "job-1",
  kind: "capsuleGenerate",
  status: "queued",
  phase: "queued",
  progress: { current: 0, total: null, label: null },
  entity: { type: "capsule", id: "capsule-1" },
  result: null,
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
  failedAt: null,
} as JobSnapshot;

test("sendQueuedJob returns the public 202 job envelope", () => {
  const res = {
    json: vi.fn((body) => body),
    status: vi.fn(() => res),
  };

  expect(sendQueuedJob(res, snapshot)).toEqual({ ok: true, job: snapshot });
  expect(res.status).toHaveBeenCalledWith(202);
});

test("enqueueRouteJob delegates to injected queue and fails closed when unavailable", async () => {
  const enqueueJobImpl = vi.fn(async () => snapshot);

  await expect(
    enqueueRouteJob(
      { enqueueJobImpl },
      {
        kind: "capsuleGenerate",
        profileEmail: "person@example.com",
        payload: {},
      },
    ),
  ).resolves.toBe(snapshot);

  await expect(
    enqueueRouteJob(
      {},
      {
        kind: "capsuleGenerate",
        profileEmail: "person@example.com",
        payload: {},
      },
    ),
  ).rejects.toThrow("job_queue_unavailable");
});

test("sendJobEnqueueError maps active job caps to 429", () => {
  const res = {
    json: vi.fn((body) => body),
    status: vi.fn(() => res),
  };
  const error = Object.assign(new Error("too_many_active_jobs"), {
    code: "too_many_active_jobs",
  });

  expect(sendJobEnqueueError(res, error)).toEqual({
    error: "too_many_active_jobs",
  });
  expect(res.status).toHaveBeenCalledWith(429);
  expect(sendJobEnqueueError(res, new Error("queue_down"))).toBeNull();
});
