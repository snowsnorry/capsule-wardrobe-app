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

const DEFAULT_JOB_WAIT_TIMEOUT_MS = 16 * 60 * 1000;

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

// eslint-disable-next-line complexity
async function pollJobUntilTerminal(
  id: string,
  { signal, timeoutMs }: WaitForJobOptions = {},
): Promise<JobSnapshot> {
  const startedAt = Date.now();
  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_JOB_WAIT_TIMEOUT_MS;
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
    if (
      Number.isFinite(effectiveTimeoutMs) &&
      effectiveTimeoutMs > 0 &&
      Date.now() - startedAt >= effectiveTimeoutMs
    ) {
      throw new Error("job_status_check_failed");
    }
    await delay(1500, signal);
  }
}

async function waitForJob(
  id: string,
  options: WaitForJobOptions = {},
): Promise<JobSnapshot> {
  return pollJobUntilTerminal(id, options);
}

async function subscribeUserJobEvents({
  lastEventId,
  onCursor,
  onJob,
  onSync,
  signal,
}: {
  lastEventId?: number;
  onCursor?: (cursor: number) => void;
  onJob: (job: JobSnapshot) => void;
  onSync?: (jobs: JobSnapshot[]) => void;
  signal?: AbortSignal;
}) {
  const fetchEventSource = await loadFetchEventSource();
  return fetchEventSource(jobsUrl("/events"), {
    credentials: "include",
    headers:
      Number.isSafeInteger(lastEventId) && Number(lastEventId) > 0
        ? { "Last-Event-ID": String(lastEventId) }
        : undefined,
    signal,
    openWhenHidden: true,
    onmessage(event: { data?: string; event?: string; id?: string }) {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data) as {
          cursor?: unknown;
          job?: unknown;
          jobs?: unknown;
        };
        const cursor = Number(event.id || data.cursor);
        if (Number.isSafeInteger(cursor) && cursor >= 0) onCursor?.(cursor);
        if (event.event === "sync" && Array.isArray(data.jobs)) {
          const jobs = data.jobs.filter(isJobSnapshot);
          for (const job of jobs) emitJobSnapshot(job);
          onSync?.(jobs);
          return;
        }
        if (isJobSnapshot(data.job)) {
          emitJobSnapshot(data.job);
          onJob(data.job);
        }
      } catch {
        // Ignore malformed transient events; polling can recover.
      }
    },
    onclose() {
      if (!signal?.aborted) throw new Error("event_stream_closed");
    },
    onerror() {
      if (signal?.aborted) return undefined;
      return 1000;
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
  subscribeUserJobEvents,
  waitForJob,
};
export type { JobResponse, JobSnapshot };
