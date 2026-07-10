import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCachedJson: vi.fn(),
  requestJson: vi.fn(),
}));
const eventSourceApi = vi.hoisted(() => ({ fetchEventSource: vi.fn() }));

vi.mock("./request", () => requestApi);
vi.mock("@microsoft/fetch-event-source", () => eventSourceApi);
vi.mock("./config", () => ({ API_BASE_URL: "https://api.example.test" }));

import {
  addJobSnapshotListener,
  fetchActiveJobs,
  fetchJob,
  getJobEntityKey,
  parseJobResponse,
  parseTrackedJobResponse,
  subscribeUserJobEvents,
  waitForJob,
  type JobSnapshot,
} from "./jobs";

function createJob(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "job-1",
    kind: "capsuleReportGenerate",
    status: "queued",
    phase: "queued",
    progress: { current: 0, total: 1, label: "Queued" },
    entity: { type: "capsule", id: "capsule-1" },
    result: null,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    ...overrides,
  } as JobSnapshot;
}

describe("jobs api", () => {
  beforeEach(() => {
    vi.useRealTimers();
    requestApi.getCachedJson.mockReset();
    requestApi.requestJson.mockReset();
    eventSourceApi.fetchEventSource.mockReset();
  });

  test("fetchActiveJobs uses the authenticated active query", async () => {
    const queued = createJob();
    requestApi.getCachedJson.mockResolvedValue({
      ok: true,
      jobs: [queued, { kind: "missing-id" }],
    });
    await expect(fetchActiveJobs({ force: true })).resolves.toEqual({
      ok: true,
      jobs: [queued],
    });
    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/jobs?status=active",
      { credentials: "include", force: true, ttlMs: 500 },
    );
  });

  test("fetchJob and tracked responses publish snapshots", async () => {
    const job = createJob({ id: "job/with space" });
    const listener = vi.fn();
    const unsubscribe = addJobSnapshotListener(listener);
    requestApi.requestJson.mockResolvedValue({ ok: true, job });

    await expect(fetchJob(job.id)).resolves.toEqual({ ok: true, job });
    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/jobs/job%2Fwith%20space",
      { credentials: "include" },
    );
    expect(parseTrackedJobResponse({ ok: true, job })).toEqual({
      ok: true,
      job,
    });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    expect(() => parseJobResponse({ ok: true, job: {} })).toThrow(
      "invalid_job_response",
    );
  });

  test("waitForJob uses GET polling only", async () => {
    vi.useFakeTimers();
    const running = createJob({ status: "running" });
    const completed = createJob({ status: "completed" });
    requestApi.requestJson
      .mockResolvedValueOnce({ ok: true, job: running })
      .mockResolvedValueOnce({ ok: true, job: completed });

    const result = waitForJob("job-1");
    await vi.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toEqual(completed);
    expect(eventSourceApi.fetchEventSource).not.toHaveBeenCalled();
  });

  test("waitForJob tolerates transient GET failures and supports abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    requestApi.requestJson.mockRejectedValueOnce(new Error("network"));
    const result = waitForJob("job-1", { signal: controller.signal });
    const expectation = expect(result).rejects.toThrow("job_wait_aborted");
    await Promise.resolve();
    controller.abort();
    await vi.advanceTimersByTimeAsync(1500);
    await expectation;
  });

  test("subscribeUserJobEvents handles sync and job events on one URL", async () => {
    const queued = createJob();
    const completed = createJob({ status: "completed" });
    const onJob = vi.fn();
    const onCursor = vi.fn();
    const onSync = vi.fn();
    eventSourceApi.fetchEventSource.mockImplementation(
      async (_url, options) => {
        const onmessage = options.onmessage as (event: {
          data?: string;
          event?: string;
          id?: string;
        }) => void;
        onmessage({
          id: "7",
          event: "sync",
          data: JSON.stringify({ cursor: 7, jobs: [queued] }),
        });
        onmessage({
          id: "8",
          event: "complete",
          data: JSON.stringify({ job: completed }),
        });
        onmessage({ event: "progress", data: "{bad" });
      },
    );

    await subscribeUserJobEvents({ lastEventId: 6, onCursor, onJob, onSync });
    expect(eventSourceApi.fetchEventSource).toHaveBeenCalledWith(
      "https://api.example.test/jobs/events",
      expect.objectContaining({
        credentials: "include",
        headers: { "Last-Event-ID": "6" },
        openWhenHidden: true,
      }),
    );
    expect(onSync).toHaveBeenCalledWith([queued]);
    expect(onJob).toHaveBeenCalledWith(completed);
    expect(onCursor.mock.calls.map(([cursor]) => cursor)).toEqual([7, 8]);
  });

  test("aggregate stream retries transport failures and closes on abort", async () => {
    const controller = new AbortController();
    eventSourceApi.fetchEventSource.mockImplementation(
      async (_url, options) => {
        expect((options.onerror as () => number)()).toBe(1000);
        controller.abort();
        expect((options.onerror as () => number | undefined)()).toBeUndefined();
        expect(() => (options.onclose as () => void)()).not.toThrow();
      },
    );
    await subscribeUserJobEvents({
      onJob: vi.fn(),
      signal: controller.signal,
    });
  });

  test("getJobEntityKey creates stable deduplication keys", () => {
    expect(getJobEntityKey(createJob())).toBe("capsule:capsule-1");
    expect(
      getJobEntityKey(
        createJob({ entity: { type: "outfit", id: "outfit-1" } }),
      ),
    ).toBe("outfit:outfit-1");
    expect(
      getJobEntityKey(createJob({ entity: { type: "wardrobe", id: null } })),
    ).toBe("wardrobe");
    expect(getJobEntityKey(createJob({ entity: null }))).toBe("");
  });
});
