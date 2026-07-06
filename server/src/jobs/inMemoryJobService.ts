import crypto from "node:crypto";
import { JOB_RUN_TIMEOUT_MS } from "../appConfig.js";
import type { EnqueueJobInput, JobSnapshot, JobStatus } from "./types.js";
import { addJobMetricCount, createEmptyJobMetrics } from "./jobMetrics.js";

const QUEUED_STUCK_MS = 5 * 60 * 1000;
const ACTIVE_TOTAL_JOB_CAP = 8;
const ACTIVE_GENERATION_JOB_CAP = 4;
const ACTIVE_UPLOAD_JOB_CAP = 2;
const ACTIVE_REPORT_KIND_CAP = 1;
const UPLOAD_JOB_KINDS = new Set([
  "personalItemUploadFiles",
  "personalItemUploadUrls",
]);
const REPORT_JOB_KINDS = new Set([
  "capsuleReportGenerate",
  "outfitReportGenerate",
  "personalItemsReportGenerate",
]);
const GENERATION_JOB_KINDS = new Set([
  "capsuleGenerate",
  "capsuleRegenerateSelected",
  "capsuleReportGenerate",
  "outfitImageGenerate",
  "outfitReportGenerate",
  "outfitSetImageGenerate",
  "personalItemsReportGenerate",
]);

function now() {
  return new Date().toISOString();
}

function toSnapshot(input: EnqueueJobInput, id: string): JobSnapshot {
  const timestamp = now();
  return {
    id,
    kind: input.kind,
    status: "queued",
    phase: input.phase || "queued",
    progress: {
      current: 0,
      total: input.progressTotal ?? null,
      label: input.progressLabel || null,
    },
    entity: input.entity || null,
    result: null,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: null,
    completedAt: null,
    failedAt: null,
  };
}

function isActive(job: JobSnapshot) {
  return job.status === "queued" || job.status === "running";
}

function isStuck(job: JobSnapshot) {
  const updatedAt = Date.parse(job.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return false;
  }
  const ageMs = Date.now() - updatedAt;
  return (
    (job.status === "queued" && ageMs >= QUEUED_STUCK_MS) ||
    (job.status === "running" && ageMs >= JOB_RUN_TIMEOUT_MS)
  );
}

function normalizeEmail(email: unknown) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function createTooManyActiveJobsError(): Error & { code: string } {
  const error = new Error("too_many_active_jobs") as Error & { code: string };
  error.code = "too_many_active_jobs";
  return error;
}

type InMemoryActiveJobCounts = {
  generation: number;
  reportKind: number;
  total: number;
  upload: number;
};

function getInMemoryActiveJobCounts({
  kind,
  jobs,
  owners,
  profileEmail,
}: {
  kind: EnqueueJobInput["kind"];
  jobs: Map<string, JobSnapshot>;
  owners: Map<string, string>;
  profileEmail: string;
}): InMemoryActiveJobCounts {
  const counts: InMemoryActiveJobCounts = {
    generation: 0,
    reportKind: 0,
    total: 0,
    upload: 0,
  };
  for (const job of jobs.values()) {
    if (owners.get(job.id) !== profileEmail || !isActive(job)) {
      continue;
    }
    counts.total += 1;
    if (GENERATION_JOB_KINDS.has(job.kind)) counts.generation += 1;
    if (UPLOAD_JOB_KINDS.has(job.kind)) counts.upload += 1;
    if (REPORT_JOB_KINDS.has(job.kind) && job.kind === kind) {
      counts.reportKind += 1;
    }
  }
  return counts;
}

function exceedsInMemoryActiveJobCapacity(
  kind: EnqueueJobInput["kind"],
  counts: InMemoryActiveJobCounts,
) {
  const exceedsUploadCap =
    UPLOAD_JOB_KINDS.has(kind) && counts.upload >= ACTIVE_UPLOAD_JOB_CAP;
  const exceedsGenerationCap =
    GENERATION_JOB_KINDS.has(kind) &&
    counts.generation >= ACTIVE_GENERATION_JOB_CAP;
  const exceedsReportKindCap =
    REPORT_JOB_KINDS.has(kind) && counts.reportKind >= ACTIVE_REPORT_KIND_CAP;
  return (
    counts.total >= ACTIVE_TOTAL_JOB_CAP ||
    exceedsUploadCap ||
    exceedsGenerationCap ||
    exceedsReportKindCap
  );
}

function assertInMemoryActiveJobCapacity({
  input,
  jobs,
  owners,
  profileEmail,
}: {
  input: EnqueueJobInput;
  jobs: Map<string, JobSnapshot>;
  owners: Map<string, string>;
  profileEmail: string;
}) {
  const counts = getInMemoryActiveJobCounts({
    kind: input.kind,
    jobs,
    owners,
    profileEmail,
  });
  if (exceedsInMemoryActiveJobCapacity(input.kind, counts)) {
    throw createTooManyActiveJobsError();
  }
}

async function clearJobRunsForEmail({
  dedupe,
  email,
  jobs,
  owners,
}: {
  dedupe: Map<string, string>;
  email: string;
  jobs: Map<string, JobSnapshot>;
  owners: Map<string, string>;
}) {
  const normalizedEmail = normalizeEmail(email);
  let deleted = 0;
  for (const [id, owner] of owners.entries()) {
    if (owner !== normalizedEmail) continue;
    jobs.delete(id);
    owners.delete(id);
    deleted += 1;
  }
  for (const [key, id] of dedupe.entries()) {
    if (!jobs.has(id)) {
      dedupe.delete(key);
    }
  }
  return deleted;
}

async function enqueueInMemoryJob({
  dedupe,
  input,
  jobs,
  owners,
}: {
  dedupe: Map<string, string>;
  input: EnqueueJobInput;
  jobs: Map<string, JobSnapshot>;
  owners: Map<string, string>;
}) {
  const profileEmail = normalizeEmail(input.profileEmail);
  const dedupeKey = `${profileEmail}:${input.kind}:${input.dedupeKey || ""}`;
  const existingId = input.dedupeKey ? dedupe.get(dedupeKey) : "";
  const existing = existingId ? jobs.get(existingId) : null;
  if (existing && isActive(existing)) {
    return existing;
  }

  assertInMemoryActiveJobCapacity({ input, jobs, owners, profileEmail });

  const job = toSnapshot(input, crypto.randomUUID());
  jobs.set(job.id, job);
  owners.set(job.id, profileEmail);
  if (input.dedupeKey) {
    dedupe.set(dedupeKey, job.id);
  }
  return job;
}

function listActiveJobSnapshotsForEntity({
  email,
  entityId,
  entityType,
  jobs,
  kinds,
  owners,
}: {
  email: string;
  entityId?: string | null;
  entityType: string;
  jobs: Map<string, JobSnapshot>;
  kinds?: string[] | null;
  owners: Map<string, string>;
}) {
  const kindSet = new Set(
    Array.isArray(kinds)
      ? kinds.map((kind) => String(kind || "").trim()).filter(Boolean)
      : [],
  );
  return Array.from(jobs.values()).filter((job) => {
    if (owners.get(job.id) !== normalizeEmail(email) || !isActive(job)) {
      return false;
    }
    if (job.entity?.type !== entityType) {
      return false;
    }
    if (entityId && job.entity.id !== entityId) {
      return false;
    }
    return kindSet.size === 0 || kindSet.has(job.kind);
  });
}

function listJobSnapshots({
  email,
  jobs,
  owners,
  status,
}: {
  email: string;
  jobs: Map<string, JobSnapshot>;
  owners: Map<string, string>;
  status?: "active" | JobStatus | null;
}) {
  return Array.from(jobs.values()).filter((job) => {
    if (owners.get(job.id) !== normalizeEmail(email)) {
      return false;
    }
    return status === "active"
      ? isActive(job)
      : status
        ? job.status === status
        : true;
  });
}

function buildJobMetrics(jobs: Map<string, JobSnapshot>) {
  const metrics = createEmptyJobMetrics();
  for (const job of jobs.values()) {
    addJobMetricCount({
      count: 1,
      kind: job.kind,
      metrics,
      status: job.status,
    });
    if (isStuck(job)) {
      metrics.stuck.total += 1;
      if (job.status === "queued" || job.status === "running") {
        metrics.stuck[job.status] += 1;
      }
    }
  }
  return metrics;
}

export function createInMemoryJobService() {
  const jobs = new Map<string, JobSnapshot>();
  const owners = new Map<string, string>();
  const dedupe = new Map<string, string>();

  return {
    clearJobRunsForEmailImpl: async (email: string) =>
      clearJobRunsForEmail({ dedupe, email, jobs, owners }),
    enqueueJobImpl: async (input: EnqueueJobInput) =>
      enqueueInMemoryJob({ dedupe, input, jobs, owners }),
    getJobSnapshotImpl: async ({ id, email }: { id: string; email: string }) =>
      owners.get(id) === normalizeEmail(email) ? jobs.get(id) || null : null,
    listActiveJobsForEntityImpl: async () => [],
    listActiveJobSnapshotsForEntityImpl: async ({
      email,
      entityType,
      entityId,
      kinds,
    }: {
      email: string;
      entityType: string;
      entityId?: string | null;
      kinds?: string[] | null;
    }) =>
      listActiveJobSnapshotsForEntity({
        email,
        entityId,
        entityType,
        jobs,
        kinds,
        owners,
      }),
    getJobMetricsImpl: async () => buildJobMetrics(jobs),
    listJobSnapshotsImpl: async ({
      email,
      status,
    }: {
      email: string;
      status?: "active" | JobStatus | null;
    }) => listJobSnapshots({ email, jobs, owners, status }),
    listJobEventsAfterImpl: async () => [],
    startJobWorkersImpl: async () => {},
    stopJobWorkersImpl: async () => {},
  };
}
