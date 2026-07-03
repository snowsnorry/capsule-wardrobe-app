import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCachedJson: vi.fn(),
  requestJson: vi.fn(),
}));

const eventSourceApi = vi.hoisted(() => ({
  fetchEventSource: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("@microsoft/fetch-event-source", () => eventSourceApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import {
  addJobSnapshotListener,
  fetchActiveJobs,
  fetchJob,
  getJobEntityKey,
  parseJobResponse,
  parseTrackedJobResponse,
  subscribeJobEvents,
  waitForJob,
} from "./jobs";
import type { JobSnapshot } from "./jobs";

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

  test("fetchActiveJobs uses cached authenticated active query and drops malformed rows", async () => {
    const queued = createJob();
    requestApi.getCachedJson.mockResolvedValue({
      ok: true,
      jobs: [queued, { kind: "missing-id" }, null],
    });

    await expect(fetchActiveJobs({ force: true })).resolves.toEqual({
      ok: true,
      jobs: [queued],
    });
    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/jobs?status=active",
      {
        credentials: "include",
        force: true,
        ttlMs: 500,
      },
    );
  });

  test("fetchJob parses the public job response contract and rejects malformed payloads", async () => {
    const job = createJob({ id: "job/with space" });
    const onSnapshot = vi.fn();
    const unsubscribe = addJobSnapshotListener(onSnapshot);
    requestApi.requestJson.mockResolvedValueOnce({ ok: true, job });

    await expect(fetchJob("job/with space")).resolves.toEqual({
      ok: true,
      job,
    });
    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/jobs/job%2Fwith%20space",
      { credentials: "include" },
    );
    expect(onSnapshot).toHaveBeenCalledWith(job);
    unsubscribe();

    expect(() =>
      parseJobResponse({ ok: true, job: { kind: "missing-id" } }),
    ).toThrowError("invalid_job_response");
  });

  test("parseTrackedJobResponse publishes valid job snapshots", () => {
    const job = createJob();
    const onSnapshot = vi.fn();
    const unsubscribe = addJobSnapshotListener(onSnapshot);

    expect(parseTrackedJobResponse({ ok: true, job })).toEqual({
      ok: true,
      job,
    });
    expect(onSnapshot).toHaveBeenCalledWith(job);
    unsubscribe();
  });

  test("waitForJob uses polling fallback only after the SSE stream closes", async () => {
    vi.useFakeTimers();
    const running = createJob({ status: "running" });
    const completed = createJob({
      status: "completed",
      completedAt: "2026-01-01T00:01:00.000Z",
    });
    eventSourceApi.fetchEventSource.mockResolvedValue(undefined);
    requestApi.requestJson
      .mockResolvedValueOnce({ ok: true, job: running })
      .mockResolvedValueOnce({ ok: true, job: completed });

    const result = waitForJob("job-1", { timeoutMs: 0 });
    expect(requestApi.requestJson).not.toHaveBeenCalled();

    await Promise.resolve();
    await vi.runOnlyPendingTimersAsync();

    await expect(result).resolves.toEqual(completed);
    expect(requestApi.requestJson).toHaveBeenCalledTimes(2);
  });

  test("waitForJob resolves from SSE without polling", async () => {
    const completed = createJob({
      status: "completed",
      completedAt: "2026-01-01T00:01:00.000Z",
    });
    eventSourceApi.fetchEventSource.mockImplementation(
      async (_url, options) => {
        const onmessage = options.onmessage as (event: {
          data?: string;
        }) => void;
        onmessage({ data: JSON.stringify({ job: completed }) });
      },
    );

    await expect(waitForJob("job-1")).resolves.toEqual(completed);
    expect(requestApi.requestJson).not.toHaveBeenCalled();
  });

  test("waitForJob keeps waiting after transient fallback polling failures", async () => {
    vi.useFakeTimers();
    const completed = createJob({
      status: "completed",
      completedAt: "2026-01-01T00:01:00.000Z",
    });
    eventSourceApi.fetchEventSource.mockResolvedValue(undefined);
    requestApi.requestJson
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true, job: completed });

    const result = waitForJob("job-1", { timeoutMs: 0 });
    await Promise.resolve();
    await vi.runOnlyPendingTimersAsync();

    await expect(result).resolves.toEqual(completed);
    expect(requestApi.requestJson).toHaveBeenCalledTimes(2);
  });

  test("waitForJob aborts SSE and rejects when the wait timeout expires", async () => {
    vi.useFakeTimers();
    eventSourceApi.fetchEventSource.mockImplementation(
      () => new Promise(() => undefined),
    );

    const result = waitForJob("job-1", { timeoutMs: 25 });
    const expectation = expect(result).rejects.toThrow("job_wait_timeout");
    await vi.advanceTimersByTimeAsync(25);

    await expectation;
    const options = eventSourceApi.fetchEventSource.mock.calls[0]?.[1] as {
      signal?: AbortSignal;
    };
    expect(options.signal?.aborted).toBe(true);
  });

  test("waitForJob rejects with job_wait_aborted when caller aborts", async () => {
    const controller = new AbortController();
    eventSourceApi.fetchEventSource.mockImplementation(
      () => new Promise(() => undefined),
    );

    const result = waitForJob("job-1", {
      signal: controller.signal,
      timeoutMs: 0,
    });
    controller.abort();

    await expect(result).rejects.toThrow("job_wait_aborted");
    const options = eventSourceApi.fetchEventSource.mock.calls[0]?.[1] as {
      signal?: AbortSignal;
    };
    expect(options.signal?.aborted).toBe(true);
  });

  test("subscribeJobEvents forwards valid job snapshots and ignores malformed events", async () => {
    const onJob = vi.fn();
    const onSnapshot = vi.fn();
    const unsubscribe = addJobSnapshotListener(onSnapshot);
    const signal = new AbortController().signal;
    const failed = createJob({
      status: "failed",
      entity: { type: "wardrobe", id: null },
    });
    eventSourceApi.fetchEventSource.mockImplementation(
      async (_url, options) => {
        const onmessage = options.onmessage as (event: {
          data?: string;
        }) => void;
        onmessage({ data: "" });
        onmessage({ data: "{bad json" });
        onmessage({ data: JSON.stringify({ job: { kind: "missing-id" } }) });
        onmessage({ data: JSON.stringify({ job: failed }) });
      },
    );

    await subscribeJobEvents({ id: "job-1", onJob, signal });

    expect(eventSourceApi.fetchEventSource).toHaveBeenCalledWith(
      "https://api.example.test/jobs/job-1/events",
      expect.objectContaining({
        credentials: "include",
        openWhenHidden: true,
        signal,
      }),
    );
    expect(onJob).toHaveBeenCalledWith(failed);
    expect(onSnapshot).toHaveBeenCalledWith(failed);
    unsubscribe();
  });

  test("subscribeJobEvents fails fast on stream errors instead of allowing hidden retries", async () => {
    const streamError = new Error("stream failed");
    eventSourceApi.fetchEventSource.mockImplementation((_url, options) => {
      const onerror = options.onerror as (error: unknown) => void;
      onerror(streamError);
      return Promise.resolve();
    });

    await expect(
      subscribeJobEvents({ id: "job-1", onJob: vi.fn() }),
    ).rejects.toThrow("stream failed");
  });

  test("getJobEntityKey creates stable sidebar keys for entity-scoped jobs", () => {
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
