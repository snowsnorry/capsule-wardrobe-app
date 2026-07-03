import { API_BASE_URL } from "./config";
import { getCachedJson, requestJson } from "./request";
import type { JsonObject } from "./request";

type JobStatus = "queued" | "running" | "completed" | "failed";
type JobEntity = {
  type: "capsule" | "outfit" | "wardrobe";
  id: string | null;
};
type JobSnapshot = {
  id: string;
  kind: string;
  status: JobStatus;
  phase: string | null;
  progress: {
    current: number;
    total: number | null;
    label: string | null;
  };
  entity: JobEntity | null;
  result: JsonObject | null;
  error: { code: string; message: string | null } | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};
type JobResponse = {
  ok: true;
  job: JobSnapshot;
};
type JobsResponse = {
  ok: true;
  jobs: JobSnapshot[];
};
type EventStreamLike = {
  fetchEventSource: (
    url: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};
type WaitForJobOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};
type JobSnapshotListener = (job: JobSnapshot) => void;
type JobWaitReconciliationInput = {
  cycleController: AbortController;
  fail: (error: unknown) => void;
  id: string;
  settle: (job: JobSnapshot) => void;
  startCycle: () => void;
};
type JobWaitPollingInput = {
  cycleController: AbortController;
  fail: (error: unknown) => void;
  getController: () => AbortController | null;
  id: string;
  isSettled: () => boolean;
  settle: (job: JobSnapshot) => void;
};

const DEFAULT_JOB_WAIT_TIMEOUT_MS = 10 * 60 * 1000;

let fetchEventSourcePromise: Promise<
  EventStreamLike["fetchEventSource"]
> | null = null;
const jobSnapshotListeners = new Set<JobSnapshotListener>();

function loadFetchEventSource(): Promise<EventStreamLike["fetchEventSource"]> {
  if (!fetchEventSourcePromise) {
    fetchEventSourcePromise = import("@microsoft/fetch-event-source").then(
      (module) => module.fetchEventSource,
    );
  }
  return fetchEventSourcePromise;
}

function jobsUrl(path = "") {
  return `${API_BASE_URL}/jobs${path}`;
}

function isJobSnapshot(value: unknown): value is JobSnapshot {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string",
  );
}

function parseJobResponse(response: JsonObject): JobResponse {
  const job = response.job;
  if (response.ok !== true || !isJobSnapshot(job)) {
    throw new Error("invalid_job_response");
  }
  return { ok: true, job };
}

function parseTrackedJobResponse(response: JsonObject): JobResponse {
  const parsed = parseJobResponse(response);
  emitJobSnapshot(parsed.job);
  return parsed;
}

async function fetchActiveJobs(options: { force?: boolean } = {}) {
  const response = await getCachedJson(`${jobsUrl()}?status=active`, {
    credentials: "include",
    force: options.force,
    ttlMs: 500,
  });
  const jobs = Array.isArray(response.jobs)
    ? response.jobs.filter(isJobSnapshot)
    : [];
  return { ok: true, jobs } as JobsResponse;
}

function emitJobSnapshot(job: JobSnapshot) {
  for (const listener of jobSnapshotListeners) {
    listener(job);
  }
}

function addJobSnapshotListener(listener: JobSnapshotListener) {
  jobSnapshotListeners.add(listener);
  return () => {
    jobSnapshotListeners.delete(listener);
  };
}

async function fetchJob(id: string) {
  const response = parseJobResponse(
    await requestJson(jobsUrl(`/${encodeURIComponent(id)}`), {
      credentials: "include",
    }),
  );
  emitJobSnapshot(response.job);
  return response;
}

function isTerminalJob(job: JobSnapshot) {
  return job.status === "completed" || job.status === "failed";
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("job_wait_aborted"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error("job_wait_aborted"));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function pollJobUntilTerminal(
  id: string,
  signal?: AbortSignal,
): Promise<JobSnapshot> {
  for (;;) {
    if (signal?.aborted) {
      throw new Error("job_wait_aborted");
    }
    try {
      const { job } = await fetchJob(id);
      if (isTerminalJob(job)) {
        return job;
      }
    } catch {
      if (signal?.aborted) {
        throw new Error("job_wait_aborted");
      }
    }
    await delay(1500, signal);
  }
}

async function reconcileJobWaitAfterWatchdog({
  cycleController,
  fail,
  id,
  settle,
  startCycle,
}: JobWaitReconciliationInput) {
  cycleController.abort();
  try {
    const { job } = await fetchJob(id);
    if (isTerminalJob(job)) {
      settle(job);
      return;
    }
    startCycle();
  } catch {
    fail(new Error("job_status_check_failed"));
  }
}

function startJobWaitFallbackPolling({
  cycleController,
  fail,
  getController,
  id,
  isSettled,
  settle,
}: JobWaitPollingInput) {
  void pollJobUntilTerminal(id, cycleController.signal).then(
    settle,
    (error) => {
      if (
        !isSettled() &&
        getController() === cycleController &&
        !cycleController.signal.aborted
      ) {
        fail(error);
      }
    },
  );
}

async function waitForJob(
  id: string,
  options: WaitForJobOptions = {},
): Promise<JobSnapshot> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_JOB_WAIT_TIMEOUT_MS;
  if (options.signal?.aborted) throw new Error("job_wait_aborted");

  return new Promise<JobSnapshot>((resolve, reject) => {
    let settled = false;
    let controller: AbortController | null = null;
    let timeout: number | null = null;
    const clearWatchdog = () => {
      if (timeout === null) return;
      window.clearTimeout(timeout);
      timeout = null;
    };
    const settle = (job: JobSnapshot) => {
      if (settled) return;
      settled = true;
      clearWatchdog();
      controller?.abort();
      options.signal?.removeEventListener("abort", abortFromCaller);
      resolve(job);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearWatchdog();
      controller?.abort();
      options.signal?.removeEventListener("abort", abortFromCaller);
      reject(error);
    };
    function abortFromCaller() {
      fail(new Error("job_wait_aborted"));
    }
    function scheduleWatchdog(cycleController: AbortController) {
      clearWatchdog();
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return;
      timeout = window.setTimeout(() => {
        clearWatchdog();
        void reconcileJobWaitAfterWatchdog({
          cycleController,
          fail,
          id,
          settle,
          startCycle,
        });
      }, timeoutMs);
    }
    function startCycle() {
      if (settled || options.signal?.aborted) {
        if (options.signal?.aborted) {
          fail(new Error("job_wait_aborted"));
        }
        return;
      }
      const cycleController = new AbortController();
      controller = cycleController;
      scheduleWatchdog(cycleController);
      void subscribeJobEvents({
        id,
        signal: cycleController.signal,
        onJob(job) {
          if (isTerminalJob(job)) settle(job);
        },
      })
        .catch(() => undefined)
        .finally(() => {
          if (
            !settled &&
            controller === cycleController &&
            !cycleController.signal.aborted
          ) {
            startJobWaitFallbackPolling({
              cycleController,
              fail,
              getController: () => controller,
              id,
              isSettled: () => settled,
              settle,
            });
          }
        });
    }
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    startCycle();
  });
}

async function subscribeJobEvents({
  id,
  onJob,
  signal,
}: {
  id: string;
  onJob: (job: JobSnapshot) => void;
  signal?: AbortSignal;
}) {
  const fetchEventSource = await loadFetchEventSource();
  return fetchEventSource(jobsUrl(`/${encodeURIComponent(id)}/events`), {
    credentials: "include",
    signal,
    openWhenHidden: true,
    onmessage(event: { data?: string }) {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data) as { job?: unknown };
        if (isJobSnapshot(data.job)) {
          emitJobSnapshot(data.job);
          onJob(data.job);
        }
      } catch {
        // Ignore malformed transient events; polling can recover.
      }
    },
    onerror(error: unknown) {
      throw error;
    },
  });
}

function getJobEntityKey(job: JobSnapshot): string {
  if (!job.entity) return "";
  return job.entity.type === "wardrobe"
    ? "wardrobe"
    : `${job.entity.type}:${job.entity.id || ""}`;
}

export {
  addJobSnapshotListener,
  fetchActiveJobs,
  fetchJob,
  getJobEntityKey,
  parseJobResponse,
  parseTrackedJobResponse,
  subscribeJobEvents,
  waitForJob,
};
export type { JobResponse, JobSnapshot };
