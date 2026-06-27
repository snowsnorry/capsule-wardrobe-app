import crypto from "node:crypto";
import { runJobHandler } from "../jobs/jobHandlers.js";
import type {
  EnqueueJobInput,
  JobEventRecord,
  JobRunRecord,
  JobSnapshot,
  JobStatus,
} from "../jobs/types.js";

type HandlerDeps = Record<string, unknown>;

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

async function runE2eJob({
  deps,
  job,
  jobs,
  owners,
}: {
  deps: HandlerDeps;
  job: JobRunRecord;
  jobs: Map<string, JobRunRecord>;
  owners: Map<string, string>;
}) {
  const startedAt = now();
  job.status = "running";
  job.phase = "running";
  job.progressLabel = "Running";
  job.startedAt = startedAt;
  job.updatedAt = startedAt;
  saveJob(jobs, owners, job);

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
  return saveJob(jobs, owners, job);
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

export function createE2eJobDependencies(deps: HandlerDeps) {
  const jobs = new Map<string, JobRunRecord>();
  const owners = new Map<string, string>();

  return {
    clearJobRunsForEmailImpl: async (email: string) => {
      const normalizedEmail = normalizeEmail(email);
      let deleted = 0;
      for (const [id, owner] of owners.entries()) {
        if (owner !== normalizedEmail) continue;
        jobs.delete(id);
        owners.delete(id);
        deleted += 1;
      }
      return deleted;
    },
    enqueueJobImpl: async (input: EnqueueJobInput) => {
      const job = toJobRecord(input, crypto.randomUUID());
      saveJob(jobs, owners, job);
      try {
        return await runE2eJob({ deps, job, jobs, owners });
      } catch (error) {
        return failE2eJob(jobs, owners, job, error);
      }
    },
    getJobSnapshotImpl: async ({ id, email }: { id: string; email: string }) =>
      owners.get(id) === normalizeEmail(email) && jobs.has(id)
        ? toJobSnapshot(jobs.get(id) as JobRunRecord)
        : null,
    listJobEventsAfterImpl: async (): Promise<JobEventRecord[]> => [],
    listJobSnapshotsImpl: async ({
      email,
      status,
    }: {
      email: string;
      status?: "active" | JobStatus | null;
    }) =>
      Array.from(jobs.values())
        .filter((job) => {
          if (owners.get(job.id) !== normalizeEmail(email)) return false;
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
