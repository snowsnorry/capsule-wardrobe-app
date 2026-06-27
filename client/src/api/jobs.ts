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
};

let fetchEventSourcePromise: Promise<
  EventStreamLike["fetchEventSource"]
> | null = null;

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

async function fetchJob(id: string) {
  return parseJobResponse(
    await requestJson(jobsUrl(`/${encodeURIComponent(id)}`), {
      credentials: "include",
    }),
  );
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
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new Error("job_wait_aborted"));
      },
      { once: true },
    );
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

async function waitForJob(
  id: string,
  options: WaitForJobOptions = {},
): Promise<JobSnapshot> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) {
    throw new Error("job_wait_aborted");
  }
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  return new Promise<JobSnapshot>((resolve, reject) => {
    let settled = false;
    const settle = (job: JobSnapshot) => {
      if (settled) return;
      settled = true;
      controller.abort();
      options.signal?.removeEventListener("abort", abortFromCaller);
      resolve(job);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      controller.abort();
      options.signal?.removeEventListener("abort", abortFromCaller);
      reject(error);
    };

    const poll = () => {
      void pollJobUntilTerminal(id, controller.signal).then(settle, fail);
    };

    void subscribeJobEvents({
      id,
      signal: controller.signal,
      onJob(job) {
        if (isTerminalJob(job)) {
          settle(job);
        }
      },
    })
      .catch(() => undefined)
      .finally(() => {
        if (!settled && !controller.signal.aborted) {
          poll();
        }
      });
    poll();
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
          onJob(data.job);
        }
      } catch {
        // Ignore malformed transient events; polling can recover.
      }
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
  fetchActiveJobs,
  fetchJob,
  getJobEntityKey,
  parseJobResponse,
  subscribeJobEvents,
  waitForJob,
};
export type { JobResponse, JobSnapshot, JobStatus };
