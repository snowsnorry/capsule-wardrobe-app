import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const jobsApi = vi.hoisted(() => ({
  addJobSnapshotListener: vi.fn(),
  fetchActiveJobs: vi.fn(),
  fetchJob: vi.fn(),
  getJobEntityKey: vi.fn((job: { entity?: { id?: string; type?: string } }) =>
    job.entity?.type === "wardrobe"
      ? "wardrobe"
      : `${job.entity?.type}:${job.entity?.id}`,
  ),
  subscribeJobEvents: vi.fn(),
  waitForJob: vi.fn(),
}));

vi.mock("../api/jobs", () => jobsApi);

import { useJobTracker } from "./useActiveSidebarJobs";
import type { JobSnapshot } from "../api/jobs";

const jobSnapshotListeners = new Set<(job: JobSnapshot) => void>();

function createJob(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "job-1",
    kind: "capsuleReportGenerate",
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
    ...overrides,
  };
}

async function flushPromises(count = 1) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  jobSnapshotListeners.clear();
  jobsApi.addJobSnapshotListener.mockReset();
  jobsApi.addJobSnapshotListener.mockImplementation((listener) => {
    jobSnapshotListeners.add(listener);
    return () => {
      jobSnapshotListeners.delete(listener);
    };
  });
  jobsApi.fetchActiveJobs.mockReset();
  jobsApi.fetchJob.mockReset();
  jobsApi.getJobEntityKey.mockClear();
  jobsApi.subscribeJobEvents.mockReset();
  jobsApi.subscribeJobEvents.mockImplementation(
    () => new Promise(() => undefined),
  );
  jobsApi.waitForJob.mockReset();
  jobsApi.waitForJob.mockImplementation(() => new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function emitJobSnapshot(job: JobSnapshot) {
  for (const listener of jobSnapshotListeners) {
    listener(job);
  }
}

test("useJobTracker discovers active jobs every 30s even while jobs are active", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);
  expect(jobsApi.subscribeJobEvents).toHaveBeenCalledWith(
    expect.objectContaining({ id: "job-1" }),
  );

  await act(async () => {
    await vi.advanceTimersByTimeAsync(29_999);
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(2);
});

test("useJobTracker discovers new jobs on the next discovery and opens SSE for them", async () => {
  const firstJob = createJob();
  const secondJob = createJob({
    id: "job-2",
    kind: "outfitReportGenerate",
    entity: { type: "outfit", id: "outfit-1" },
  });
  jobsApi.fetchActiveJobs
    .mockResolvedValueOnce({ ok: true, jobs: [firstJob] })
    .mockResolvedValueOnce({ ok: true, jobs: [firstJob, secondJob] });

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();
  });

  expect(result.current.activeJobEntityKeys).toEqual([
    "capsule:capsule-1",
    "outfit:outfit-1",
  ]);
  expect(jobsApi.subscribeJobEvents).toHaveBeenCalledWith(
    expect.objectContaining({ id: "job-1" }),
  );
  expect(jobsApi.subscribeJobEvents).toHaveBeenCalledWith(
    expect.objectContaining({ id: "job-2" }),
  );
});

test("useJobTracker resolves waiters and removes terminal jobs from SSE snapshots", async () => {
  const queued = createJob();
  const completed = createJob({
    status: "completed",
    completedAt: "2026-01-01T00:01:00.000Z",
  });
  let emitSseJob: ((job: JobSnapshot) => void) | undefined;
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });
  jobsApi.subscribeJobEvents.mockImplementation(({ onJob }) => {
    emitSseJob = onJob;
    return new Promise(() => undefined);
  });

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  const waitResultPromise = result.current.waitForJobCompletion("job-1");
  act(() => {
    emitSseJob?.(completed);
  });
  const waitResult = await waitResultPromise;

  expect(waitResult).toEqual(completed);
  expect(result.current.activeJobEntityKeys).toEqual([]);
});

test("useJobTracker pauses timer and SSE while hidden, then discovers immediately when visible", async () => {
  const visibilitySpy = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  const queued = createJob();
  const streamSignals: AbortSignal[] = [];
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });
  jobsApi.subscribeJobEvents.mockImplementation(({ signal }) => {
    streamSignals.push(signal);
    return new Promise(() => undefined);
  });

  renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);
  expect(streamSignals).toHaveLength(1);

  visibilitySpy.mockReturnValue("hidden");
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(streamSignals[0].aborted).toBe(true);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);

  visibilitySpy.mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
  });

  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(2);
  expect(streamSignals).toHaveLength(2);
});

test("useJobTracker does one terminal reconciliation fetch when a known job disappears from active discovery", async () => {
  const queued = createJob();
  const completed = createJob({
    status: "completed",
    completedAt: "2026-01-01T00:01:00.000Z",
  });
  jobsApi.fetchActiveJobs
    .mockResolvedValueOnce({ ok: true, jobs: [queued] })
    .mockResolvedValueOnce({ ok: true, jobs: [] });
  jobsApi.fetchJob.mockResolvedValue({ ok: true, job: completed });

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises(2);
  });

  expect(jobsApi.fetchJob).toHaveBeenCalledTimes(1);
  expect(jobsApi.fetchJob).toHaveBeenCalledWith("job-1");
  expect(result.current.activeJobEntityKeys).toEqual([]);
});

test("useJobTracker resolves waiters when disappeared job reconciles to failed", async () => {
  const queued = createJob();
  const failed = createJob({
    status: "failed",
    error: { code: "job_failed", message: "Generation failed" },
    failedAt: "2026-01-01T00:01:00.000Z",
  });
  jobsApi.fetchActiveJobs
    .mockResolvedValueOnce({ ok: true, jobs: [queued] })
    .mockResolvedValueOnce({ ok: true, jobs: [] });
  jobsApi.fetchJob.mockResolvedValue({ ok: true, job: failed });

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  const waitResultPromise = result.current.waitForJobCompletion("job-1");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises(2);
  });

  await expect(waitResultPromise).resolves.toEqual(failed);
  expect(result.current.activeJobEntityKeys).toEqual([]);
});

test("useJobTracker keeps active UI and waiters when disappeared job reconciles to running", async () => {
  const queued = createJob();
  const running = createJob({
    status: "running",
    phase: "running",
    progress: { current: 1, total: 3, label: "Running" },
    startedAt: "2026-01-01T00:00:30.000Z",
  });
  jobsApi.fetchActiveJobs
    .mockResolvedValueOnce({ ok: true, jobs: [queued] })
    .mockResolvedValueOnce({ ok: true, jobs: [] });
  jobsApi.fetchJob.mockResolvedValue({ ok: true, job: running });

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });
  const onResolved = vi.fn();
  void result.current.waitForJobCompletion("job-1").then(onResolved);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises(2);
  });

  expect(onResolved).not.toHaveBeenCalled();
  expect(result.current.jobs).toEqual([running]);
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);
});

test("useJobTracker waitForJobCompletion delegates to shared job watchdog", async () => {
  const queued = createJob();
  const failed = createJob({
    status: "failed",
    error: { code: "timeout", message: "Timed out" },
    failedAt: "2026-01-01T00:01:00.000Z",
  });
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });
  jobsApi.waitForJob.mockResolvedValue(failed);

  const { result } = renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises();
  });

  await expect(result.current.waitForJobCompletion("job-1")).resolves.toEqual(
    failed,
  );
  expect(jobsApi.waitForJob).toHaveBeenCalledWith("job-1");
});

test("useJobTracker does not fetch job details when SSE fails for a still-active job", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });
  jobsApi.subscribeJobEvents
    .mockRejectedValueOnce(new Error("stream failed"))
    .mockImplementation(() => new Promise(() => undefined));

  renderHook(() => useJobTracker("person@test.com"));

  await act(async () => {
    await flushPromises(2);
  });
  expect(jobsApi.subscribeJobEvents).toHaveBeenCalledTimes(1);
  expect(jobsApi.fetchJob).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises(2);
  });

  expect(jobsApi.fetchJob).not.toHaveBeenCalled();
  expect(jobsApi.subscribeJobEvents).toHaveBeenCalledTimes(2);
});

test("useJobTracker merges locally observed snapshots and clears state on logout", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [] });

  const { result, rerender } = renderHook(({ email }) => useJobTracker(email), {
    initialProps: { email: "person@test.com" },
  });

  await act(async () => {
    await flushPromises();
  });
  expect(result.current.activeJobEntityKeys).toEqual([]);

  act(() => {
    emitJobSnapshot(queued);
  });
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);

  rerender({ email: "" });
  await act(async () => {
    await flushPromises();
  });

  expect(result.current.activeJobEntityKeys).toEqual([]);
});
