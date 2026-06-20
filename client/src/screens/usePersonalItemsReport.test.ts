import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { usePersonalItemsReport } from "./usePersonalItemsReport";

const api = vi.hoisted(() => ({
  deletePersonalItemsReport: vi.fn(),
  fetchPersonalItemsReport: vi.fn(),
  generatePersonalItemsReport: vi.fn(),
}));

vi.mock("../api/personalItems", () => api);

const t = (key: string) => key;

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPersonalItemsReport.mockResolvedValue({
    ok: true,
    report: null,
    stale: false,
    generatedAt: null,
  });
  api.generatePersonalItemsReport.mockResolvedValue({
    ok: true,
    report: { verdict: { score: 0.82 } },
    stale: false,
    generatedAt: "2026-06-19T10:00:00.000Z",
  });
  api.deletePersonalItemsReport.mockResolvedValue({ ok: true, removed: true });
});

describe("usePersonalItemsReport", () => {
  test("loads, generates, refreshes, and deletes personal items reports", async () => {
    api.fetchPersonalItemsReport.mockResolvedValueOnce({
      ok: true,
      report: { verdict: { score: 0.7 } },
      stale: true,
      generatedAt: "2026-06-19T09:00:00.000Z",
    });
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));

    expect(api.fetchPersonalItemsReport).toHaveBeenCalledWith({ force: false });
    expect(result.current.report).toEqual({ verdict: { score: 0.7 } });
    expect(result.current.stale).toBe(true);

    await act(async () => {
      await result.current.generateReport();
    });
    expect(api.generatePersonalItemsReport).toHaveBeenCalledTimes(1);
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
      usePersonalItemsReport({ setError, t }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));
    await act(async () => {
      await result.current.generateReport();
    });

    expect(setError).toHaveBeenCalledWith("wardrobe.reportGenerateFailed");
    expect(result.current.isReportPending).toBe(false);
  });

  test("surfaces initial report load errors", async () => {
    api.fetchPersonalItemsReport.mockRejectedValueOnce(new Error("failed"));
    const setError = vi.fn();
    const { result } = renderHook(() =>
      usePersonalItemsReport({ setError, t }),
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
      usePersonalItemsReport({ setError, t }),
    );

    await waitFor(() => expect(result.current.isLoadingReport).toBe(false));

    act(() => {
      result.current.markStale();
    });

    expect(result.current.stale).toBe(true);
  });
});
