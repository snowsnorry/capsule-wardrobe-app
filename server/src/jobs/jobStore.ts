import {
  claimQueuedJobRunsWithoutProviderId,
  createJobRun,
  getJobRunById,
  getJobRunByIdForEmail,
  getJobRunMetrics,
  listActiveJobRunsForEntity,
  listJobEventsAfter,
  listJobRunsForEmail,
  markJobRunCompleted,
  markJobRunFailed,
  markJobRunStarted,
  markStaleRunningJobRunsFailed,
  setJobRunProviderJobId,
  updateJobRunProgress,
} from "../db.js";
import { JOB_RUN_TIMEOUT_MS } from "../appConfig.js";
import { toJobSnapshot } from "./jobSnapshots.js";
import type {
  EnqueueJobInput,
  JobEventRecord,
  JobMetrics,
  JobRunRecord,
  JobSnapshot,
  JobStatus,
} from "./types.js";

const QUEUED_STUCK_MS = 5 * 60 * 1000;

export async function createPendingJob(
  input: EnqueueJobInput,
): Promise<{ job: JobRunRecord; snapshot: JobSnapshot; deduped: boolean }> {
  const { job, deduped } = await createJobRun(input);
  return { job, snapshot: toJobSnapshot(job), deduped };
}

export async function setProviderJobId(
  id: string,
  providerJobId: string,
): Promise<JobRunRecord | null> {
  return setJobRunProviderJobId({ id, providerJobId });
}

export async function getOwnedJobSnapshot({
  id,
  email,
}: {
  id: string;
  email: string;
}): Promise<JobSnapshot | null> {
  const job = await getJobRunByIdForEmail({ id, email });
  return job ? toJobSnapshot(job) : null;
}

export async function getJobForWorker(
  id: string,
): Promise<JobRunRecord | null> {
  return getJobRunById(id);
}

export async function listOwnedJobSnapshots({
  email,
  status,
}: {
  email: string;
  status?: "active" | JobStatus | null;
}): Promise<JobSnapshot[]> {
  const jobs = await listJobRunsForEmail({ email, status });
  return jobs.map(toJobSnapshot);
}

export async function claimPendingProviderJobs({
  staleMs,
  limit,
}: {
  staleMs: number;
  limit: number;
}): Promise<JobRunRecord[]> {
  return claimQueuedJobRunsWithoutProviderId({ staleMs, limit });
}

export async function failStaleRunningJobs({
  staleMs,
  limit,
}: {
  staleMs: number;
  limit: number;
}): Promise<JobRunRecord[]> {
  return markStaleRunningJobRunsFailed({ staleMs, limit });
}

export async function listActiveJobSnapshotsForEntity({
  email,
  entityType,
  entityId,
  kinds,
}: {
  email: string;
  entityType: string;
  entityId?: string | null;
  kinds?: string[] | null;
}): Promise<JobSnapshot[]> {
  const jobs = await listActiveJobRunsForEntity({
    email,
    entityType,
    entityId,
    kinds,
  });
  return jobs.map(toJobSnapshot);
}

export async function listActiveJobsForEntity({
  email,
  entityType,
  entityId,
  kinds,
}: {
  email: string;
  entityType: string;
  entityId?: string | null;
  kinds?: string[] | null;
}): Promise<JobRunRecord[]> {
  return listActiveJobRunsForEntity({
    email,
    entityType,
    entityId,
    kinds,
  });
}

export async function startJobRun(id: string): Promise<JobRunRecord | null> {
  return markJobRunStarted(id);
}

export async function writeJobProgress({
  id,
  phase,
  current,
  total,
  label,
}: {
  id: string;
  phase?: string | null;
  current?: number;
  total?: number | null;
  label?: string | null;
}): Promise<JobRunRecord | null> {
  return updateJobRunProgress({ id, phase, current, total, label });
}

export async function completeJobRun({
  id,
  result,
}: {
  id: string;
  result?: Record<string, unknown> | null;
}): Promise<JobRunRecord | null> {
  return markJobRunCompleted({ id, result });
}

export async function failJobRun({
  id,
  errorCode,
  errorMessage,
}: {
  id: string;
  errorCode: string;
  errorMessage?: string | null;
}): Promise<JobRunRecord | null> {
  return markJobRunFailed({ id, errorCode, errorMessage });
}

export async function replayJobEvents({
  jobId,
  afterId,
}: {
  jobId: string;
  afterId?: number | null;
}): Promise<JobEventRecord[]> {
  return listJobEventsAfter({ jobId, afterId });
}

export async function getJobMetrics(): Promise<JobMetrics> {
  return getJobRunMetrics({
    queuedStuckMs: QUEUED_STUCK_MS,
    runningStuckMs: JOB_RUN_TIMEOUT_MS,
  });
}
