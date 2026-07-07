import crypto from "node:crypto";
import { runJobHandler } from "../jobs/jobHandlers.js";
import type {
  EnqueueJobInput,
  JobEventRecord,
  JobRunRecord,
  JobKind,
  JobSnapshot,
  JobStatus,
} from "../jobs/types.js";

type HandlerDeps = Record<string, unknown>;
type ManualJobMode = {
  kinds: Set<JobKind>;
};
type E2eJobStore = {
  eventOwners: Map<number, string>;
  events: JobEventRecord[];
  jobs: Map<string, JobRunRecord>;
  manualMode: ManualJobMode;
  owners: Map<string, string>;
};

function now() {
  return new Date().toISOString();
}

function normalizeEmail(email: unknown) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function toJobRecord(input: EnqueueJobInput, id: string): JobRunRecord {
  const timestamp = now();
  return {
    id,
    providerJobId: null,
    profileEmail: normalizeEmail(input.profileEmail),
    kind: input.kind,
    entityType: input.entity?.type || null,
    entityId: input.entity?.id || null,
    dedupeKey: input.dedupeKey || null,
    status: "queued",
    phase: input.phase || "queued",
    progressCurrent: 0,
    progressTotal: input.progressTotal ?? null,
    progressLabel: input.progressLabel || null,
    payload: input.payload,
    result: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: null,
  };
}

function toJobSnapshot(job: JobRunRecord): JobSnapshot {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    phase: job.phase,
    progress: {
      current: job.progressCurrent,
      total: job.progressTotal,
      label: job.progressLabel,
    },
    entity: job.entityType
      ? { type: job.entityType, id: job.entityId || null }
      : null,
    result: job.result,
    error: job.errorCode
      ? { code: job.errorCode, message: job.errorMessage }
      : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
  };
}

function isActiveStatus(status: JobStatus) {
  return status === "queued" || status === "running";
}

function saveJob(
  jobs: Map<string, JobRunRecord>,
  owners: Map<string, string>,
  job: JobRunRecord,
) {
  jobs.set(job.id, job);
  owners.set(job.id, normalizeEmail(job.profileEmail));
  return toJobSnapshot(job);
}

function addJobEvent(
  events: JobEventRecord[],
  job: JobRunRecord,
  eventType = "snapshot",
) {
  const event = {
    id: events.length + 1,
    jobId: job.id,
    eventType,
    data: { job: toJobSnapshot(job) },
    createdAt: now(),
  };
  events.push(event);
  return event;
}

async function runE2eJob({
  deps,
  job,
  jobs,
  onJobSaved,
  owners,
}: {
  deps: HandlerDeps;
  job: JobRunRecord;
  jobs: Map<string, JobRunRecord>;
  onJobSaved?: (job: JobRunRecord) => void;
  owners: Map<string, string>;
}) {
  const startedAt = now();
  job.status = "running";
  job.phase = "running";
  job.progressLabel = "Running";
  job.startedAt = startedAt;
  job.updatedAt = startedAt;
  saveJob(jobs, owners, job);
  onJobSaved?.(job);

  const result = await runJobHandler(deps, {
    job,
    updateProgress: async (update) => {
      job.phase = update.phase ?? job.phase;
      job.progressCurrent = update.current ?? job.progressCurrent;
      job.progressTotal =
        update.total === undefined ? job.progressTotal : update.total;
      job.progressLabel =
        update.label === undefined ? job.progressLabel : update.label;
      job.updatedAt = now();
      saveJob(jobs, owners, job);
      onJobSaved?.(job);
    },
  });

  const completedAt = now();
  job.status = "completed";
  job.phase = "completed";
  job.progressCurrent = job.progressTotal ?? job.progressCurrent;
  job.progressLabel = null;
  job.result = result || {};
  job.completedAt = completedAt;
  job.updatedAt = completedAt;
  const snapshot = saveJob(jobs, owners, job);
  onJobSaved?.(job);
  return snapshot;
}

function failE2eJob(
  jobs: Map<string, JobRunRecord>,
  owners: Map<string, string>,
  job: JobRunRecord,
  error: unknown,
) {
  const failedAt = now();
  job.status = "failed";
  job.phase = "failed";
  job.errorCode = String(
    (error as { code?: unknown } | null)?.code || "service_unavailable",
  );
  job.errorMessage = String((error as Error | null)?.message || "");
  job.failedAt = failedAt;
  job.updatedAt = failedAt;
  return saveJob(jobs, owners, job);
}

function createE2eJobStore(): E2eJobStore {
  return {
    eventOwners: new Map(),
    events: [],
    jobs: new Map(),
    manualMode: { kinds: new Set() },
    owners: new Map(),
  };
}

function createJobStoreActions(store: E2eJobStore) {
  function emitJobEvent(job: JobRunRecord) {
    const event = addJobEvent(store.events, job);
    store.eventOwners.set(event.id, normalizeEmail(job.profileEmail));
  }

  function saveJobWithEvent(job: JobRunRecord) {
    const snapshot = saveJob(store.jobs, store.owners, job);
    emitJobEvent(job);
    return snapshot;
  }

  return { emitJobEvent, saveJobWithEvent };
}

function createJobControls(deps: HandlerDeps, store: E2eJobStore) {
  const { emitJobEvent } = createJobStoreActions(store);

  async function completeManualJob(id: string) {
    const job = store.jobs.get(id);
    if (!job) return null;
    try {
      return await runE2eJob({
        deps,
        job,
        jobs: store.jobs,
        onJobSaved: emitJobEvent,
        owners: store.owners,
      });
    } catch (error) {
      const snapshot = failE2eJob(store.jobs, store.owners, job, error);
      emitJobEvent(job);
      return snapshot;
    }
  }

  function failManualJob(id: string, errorCode = "e2e_forced_failure") {
    const job = store.jobs.get(id);
    if (!job) return null;
    const error = new Error(errorCode) as Error & { code?: string };
    error.code = errorCode;
    const snapshot = failE2eJob(store.jobs, store.owners, job, error);
    emitJobEvent(job);
    return snapshot;
  }

  const controls = {
    clearAll: () => {
      store.jobs.clear();
      store.owners.clear();
      store.events.splice(0, store.events.length);
      store.eventOwners.clear();
      store.manualMode.kinds.clear();
    },
    completeManualJob,
    failManualJob,
    getManualMode: () => [...store.manualMode.kinds],
    setManualMode: (kinds: JobKind[]) => {
      store.manualMode.kinds = new Set(kinds);
      return controls.getManualMode();
    },
  };
  return controls;
}

function createJobRunCleanup(store: E2eJobStore) {
  return async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    let deleted = 0;
    for (const [id, owner] of store.owners.entries()) {
      if (owner !== normalizedEmail) continue;
      store.jobs.delete(id);
      store.owners.delete(id);
      deleted += 1;
    }
    for (let index = store.events.length - 1; index >= 0; index -= 1) {
      const event = store.events[index];
      if (!event) continue;
      if (store.eventOwners.get(event.id) === normalizedEmail) {
        store.events.splice(index, 1);
        store.eventOwners.delete(event.id);
      }
    }
    return deleted;
  };
}

function createJobEnqueue(deps: HandlerDeps, store: E2eJobStore) {
  const { emitJobEvent, saveJobWithEvent } = createJobStoreActions(store);

  return async (input: EnqueueJobInput) => {
    const job = toJobRecord(input, crypto.randomUUID());
    saveJobWithEvent(job);
    if (store.manualMode.kinds.has(job.kind)) {
      return toJobSnapshot(job);
    }
    try {
      return await runE2eJob({
        deps,
        job,
        jobs: store.jobs,
        onJobSaved: emitJobEvent,
        owners: store.owners,
      });
    } catch (error) {
      const snapshot = failE2eJob(store.jobs, store.owners, job, error);
      emitJobEvent(job);
      return snapshot;
    }
  };
}

export function createE2eJobDependencies(deps: HandlerDeps) {
  const store = createE2eJobStore();
  const controls = createJobControls(deps, store);

  return {
    controls,
    clearJobRunsForEmailImpl: createJobRunCleanup(store),
    enqueueJobImpl: createJobEnqueue(deps, store),
    getJobSnapshotImpl: async ({ id, email }: { id: string; email: string }) =>
      store.owners.get(id) === normalizeEmail(email) && store.jobs.has(id)
        ? toJobSnapshot(store.jobs.get(id) as JobRunRecord)
        : null,
    listJobEventsAfterImpl: async ({
      jobId,
      afterId,
    }: {
      jobId: string;
      afterId?: number | null;
    }): Promise<JobEventRecord[]> =>
      store.events.filter(
        (event) => event.jobId === jobId && event.id > Number(afterId || 0),
      ),
    listJobSnapshotsImpl: async ({
      email,
      status,
    }: {
      email: string;
      status?: "active" | JobStatus | null;
    }) =>
      Array.from(store.jobs.values())
        .filter((job) => {
          if (store.owners.get(job.id) !== normalizeEmail(email)) return false;
          return status === "active"
            ? isActiveStatus(job.status)
            : status
              ? job.status === status
              : true;
        })
        .map(toJobSnapshot),
    startJobWorkersImpl: async () => {},
    stopJobWorkersImpl: async () => {},
  };
}
