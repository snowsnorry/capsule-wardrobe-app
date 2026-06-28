import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const jobsApi = vi.hoisted(() => ({
  addJobSnapshotListener: vi.fn(),
  fetchActiveJobs: vi.fn(),
  getJobEntityKey: vi.fn((job: { entity?: { id?: string; type?: string } }) =>
    job.entity?.type === "wardrobe"
      ? "wardrobe"
      : `${job.entity?.type}:${job.entity?.id}`,
  ),
  subscribeJobEvents: vi.fn(),
}));

vi.mock("../api/jobs", () => jobsApi);

import { useActiveSidebarJobs } from "./useActiveSidebarJobs";
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
  jobsApi.getJobEntityKey.mockClear();
  jobsApi.subscribeJobEvents.mockReset();
  jobsApi.subscribeJobEvents.mockImplementation(
    () => new Promise(() => undefined),
  );
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

test("useActiveSidebarJobs bootstraps active keys without interval polling", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });

  const { result } = renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);
});

test("useActiveSidebarJobs polls idle visible tabs at a low discovery cadence", async () => {
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [] });

  renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(59_999);
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(2);
});

test("useActiveSidebarJobs does not poll the active list while known jobs are tracked by SSE", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });

  renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);
});

test("useActiveSidebarJobs pauses discovery while the document is hidden", async () => {
  const visibilitySpy = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [] });

  renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
  });
  expect(jobsApi.fetchActiveJobs).not.toHaveBeenCalled();

  visibilitySpy.mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
  });

  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(1);
});

test("useActiveSidebarJobs merges locally observed job snapshots", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValueOnce({ ok: true, jobs: [] });

  const { result } = renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeJobEntityKeys).toEqual([]);

  act(() => {
    emitJobSnapshot(queued);
  });

  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);
});

test("useActiveSidebarJobs clears active jobs when user email is empty", async () => {
  const queued = createJob();
  jobsApi.fetchActiveJobs.mockResolvedValueOnce({ ok: true, jobs: [queued] });

  const { result, rerender } = renderHook(
    ({ email }) => useActiveSidebarJobs(email),
    { initialProps: { email: "person@test.com" } },
  );

  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);

  rerender({ email: "" });

  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeJobEntityKeys).toEqual([]);
});

test("useActiveSidebarJobs removes terminal jobs from SSE snapshots", async () => {
  const queued = createJob();
  const completed = createJob({
    status: "completed",
    completedAt: "2026-01-01T00:01:00.000Z",
  });
  jobsApi.fetchActiveJobs
    .mockResolvedValueOnce({ ok: true, jobs: [queued] })
    .mockResolvedValueOnce({ ok: true, jobs: [] });
  jobsApi.subscribeJobEvents.mockImplementation(async ({ onJob }) => {
    onJob(completed);
  });

  const { result } = renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(jobsApi.subscribeJobEvents).toHaveBeenCalledWith(
    expect.objectContaining({ id: "job-1" }),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeJobEntityKeys).toEqual([]);
});

test("useActiveSidebarJobs merges non-terminal SSE snapshots", async () => {
  const queued = createJob();
  const running = createJob({ status: "running" });
  const outfitJob = createJob({
    id: "job-2",
    kind: "outfitReportGenerate",
    status: "running",
    entity: { type: "outfit", id: "outfit-1" },
  });
  jobsApi.fetchActiveJobs.mockResolvedValue({ ok: true, jobs: [queued] });
  jobsApi.subscribeJobEvents.mockImplementation(({ onJob }) => {
    onJob(running);
    onJob(outfitJob);
    return new Promise(() => undefined);
  });

  const { result } = renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.jobs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "job-1", status: "running" }),
      expect.objectContaining({ id: "job-2", status: "running" }),
    ]),
  );
});

test("useActiveSidebarJobs refetches active jobs when a non-terminal stream closes", async () => {
  const queued = createJob();
  const running = createJob({ status: "running" });
  jobsApi.fetchActiveJobs
    .mockResolvedValueOnce({ ok: true, jobs: [queued] })
    .mockResolvedValueOnce({ ok: true, jobs: [running] });
  jobsApi.subscribeJobEvents.mockResolvedValue(undefined);

  const { result } = renderHook(() => useActiveSidebarJobs("person@test.com"));

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(jobsApi.fetchActiveJobs).toHaveBeenCalledTimes(2);
  expect(result.current.jobs[0]).toMatchObject({ status: "running" });
});
