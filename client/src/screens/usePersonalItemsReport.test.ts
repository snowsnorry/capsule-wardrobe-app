import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobSnapshot } from "../api/jobs";
import { usePersonalItemsReport } from "./usePersonalItemsReport";

const api = vi.hoisted(() => ({
  deletePersonalItemsReport: vi.fn(),
  fetchPersonalItemsReport: vi.fn(),
  generatePersonalItemsReport: vi.fn(),
}));
const jobs = vi.hoisted(() => ({
  addJobSnapshotListener: vi.fn(),
}));

vi.mock("../api/personalItems", () => api);
vi.mock("../api/jobs", () => jobs);

const t = (key: string) => key;
const waitForJobCompletion = vi.fn().mockResolvedValue({
  status: "completed",
});
let jobListener: ((job: JobSnapshot) => void) | null = null;

function createJobSnapshot(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "report-job",
    kind: "personalItemsReportGenerate",
    status: "completed",
    phase: "complete",
    progress: { current: 1, total: 1, label: null },
    entity: { type: "wardrobe", id: null },
    result: null,
    error: null,
    createdAt: "2026-07-10T10:00:00.000Z",
    updatedAt: "2026-07-10T10:01:00.000Z",
    startedAt: "2026-07-10T10:00:01.000Z",
    completedAt: "2026-07-10T10:01:00.000Z",
    failedAt: null,
    ...overrides,
  };
}

function createJobResponse() {
  return {
    ok: true,
    job: {
      id: "job-1",
      kind: "personalItemsReportGenerate",
      status: "queued",
      phase: "queued",
      progress: { current: 0, total: null, label: null },
      entity: { type: "wardrobe", id: null },
      result: null,
      error: null,
      createdAt: "",
      updatedAt: "",
      startedAt: null,
      completedAt: null,
      failedAt: null,
    },
  } as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  jobListener = null;
  jobs.addJobSnapshotListener.mockImplementation(
    (listener: (job: JobSnapshot) => void) => {
      jobListener = listener;
      return vi.fn();
    },
  );
  waitForJobCompletion.mockResolvedValue({ status: "completed" });
  api.fetchPersonalItemsReport.mockResolvedValue({
    ok: true,
    report: null,
    stale: false,
    generatedAt: null,
  });
  api.generatePersonalItemsReport.mockResolvedValue({
    ...createJobResponse(),
  });
  api.deletePersonalItemsReport.mockResolvedValue({ ok: true, removed: true });
});

describe("usePersonalItemsReport", () => {
  test("loads, generates, refreshes, and deletes personal items reports", async () => {
    api.fetchPersonalItemsReport
      .mockResolvedValueOnce({
        ok: true,
        report: { verdict: { score: 0.7 } },
        stale: true,
        generatedAt: "2026-06-19T09:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ok: true,
        report: { verdict: { score: 0.82 } },
        stale: false,
        generatedAt: "2026-06-19T10:00:00.000Z",
      });
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t, waitForJobCompletion }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));

    expect(api.fetchPersonalItemsReport).toHaveBeenCalledWith({ force: false });
    expect(result.current.report).toEqual({ verdict: { score: 0.7 } });
    expect(result.current.stale).toBe(true);

    await act(async () => {
      await result.current.generateReport();
    });
    await waitFor(() =>
      expect(api.fetchPersonalItemsReport).toHaveBeenLastCalledWith({
        force: true,
      }),
    );
    expect(api.generatePersonalItemsReport).toHaveBeenCalledTimes(1);
    expect(waitForJobCompletion).toHaveBeenCalledWith("job-1");
    expect(result.current.report).toEqual({ verdict: { score: 0.82 } });
    expect(result.current.stale).toBe(false);
    expect(setError).toHaveBeenLastCalledWith("");

    api.fetchPersonalItemsReport.mockResolvedValueOnce({
      ok: true,
      report: { verdict: { score: 0.9 } },
      stale: false,
      generatedAt: "2026-06-19T11:00:00.000Z",
    });
    await act(async () => {
      await result.current.refreshReport({ force: true });
    });
    expect(api.fetchPersonalItemsReport).toHaveBeenLastCalledWith({
      force: true,
    });
    expect(result.current.report).toEqual({ verdict: { score: 0.9 } });

    await act(async () => {
      await result.current.deleteReport();
    });
    expect(api.deletePersonalItemsReport).toHaveBeenCalledTimes(1);
    expect(result.current.report).toBeNull();
  });

  test("surfaces generation errors", async () => {
    api.generatePersonalItemsReport.mockRejectedValueOnce(new Error("failed"));
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t, waitForJobCompletion }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));
    await act(async () => {
      await result.current.generateReport();
    });

    expect(setError).toHaveBeenCalledWith("wardrobe.reportGenerateFailed");
    expect(result.current.isReportPending).toBe(false);

    api.generatePersonalItemsReport.mockRejectedValueOnce(
      new Error("too_many_active_jobs"),
    );
    await act(async () => {
      await result.current.generateReport();
    });

    expect(setError).toHaveBeenCalledWith("wardrobe.reportLimitActive");
  });

  test("surfaces initial report load errors", async () => {
    api.fetchPersonalItemsReport.mockRejectedValueOnce(new Error("failed"));
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t, waitForJobCompletion }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));

    expect(setError).toHaveBeenCalledWith("wardrobe.reportLoadFailed");
    expect(result.current.report).toBeNull();
    expect(result.current.stale).toBe(false);
  });

  test("marks an existing report stale after local metadata changes", async () => {
    api.fetchPersonalItemsReport.mockResolvedValueOnce({
      ok: true,
      report: { verdict: { score: 0.7 } },
      stale: false,
      generatedAt: "2026-06-19T09:00:00.000Z",
    });
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t, waitForJobCompletion }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));

    act(() => {
      result.current.markStale();
    });

    expect(result.current.stale).toBe(true);
  });

  test("reconciles terminal report jobs from the shared job stream", async () => {
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t, waitForJobCompletion }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));
    expect(jobListener).not.toBeNull();

    act(() => {
      jobListener?.(createJobSnapshot({ status: "running" }));
      jobListener?.(
        createJobSnapshot({ kind: "capsuleGenerate", status: "completed" }),
      );
    });
    expect(api.fetchPersonalItemsReport).toHaveBeenCalledTimes(1);

    api.fetchPersonalItemsReport.mockResolvedValueOnce({
      ok: true,
      report: { verdict: { score: 0.95 } },
      stale: false,
      generatedAt: "2026-07-10T10:01:00.000Z",
    });
    const completed = createJobSnapshot();
    act(() => {
      jobListener?.(completed);
      jobListener?.(completed);
    });

    await waitFor(() =>
      expect(result.current.report).toEqual({ verdict: { score: 0.95 } }),
    );
    expect(api.fetchPersonalItemsReport).toHaveBeenCalledTimes(2);

    act(() => {
      jobListener?.(
        createJobSnapshot({
          id: "failed-report-job",
          status: "failed",
          completedAt: null,
          failedAt: "2026-07-10T10:02:00.000Z",
          updatedAt: "2026-07-10T10:02:00.000Z",
        }),
      );
    });

    expect(result.current.isReportPending).toBe(false);
    expect(setError).toHaveBeenLastCalledWith("wardrobe.reportGenerateFailed");
  });
});
