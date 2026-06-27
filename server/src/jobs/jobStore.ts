import {
  appendJobEvent,
  createJobRun,
  getJobRunById,
  getJobRunByIdForEmail,
  listJobEventsAfter,
  listJobRunsForEmail,
  markJobRunCompleted,
  markJobRunFailed,
  markJobRunStarted,
  setJobRunProviderJobId,
  updateJobRunProgress,
} from "../db.js";
import { toJobSnapshot } from "./jobSnapshots.js";
import type {
  EnqueueJobInput,
  JobEventRecord,
  JobRunRecord,
  JobSnapshot,
  JobStatus,
} from "./types.js";

export async function createPendingJob(
  input: EnqueueJobInput,
): Promise<{ job: JobRunRecord; snapshot: JobSnapshot; deduped: boolean }> {
  const { job, deduped } = await createJobRun(input);
  if (!deduped) {
    await appendJobEvent({
      jobId: job.id,
      eventType: "snapshot",
      data: { job: toJobSnapshot(job) },
    });
  }
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

export async function startJobRun(id: string): Promise<JobRunRecord | null> {
  const job = await markJobRunStarted(id);
  if (job) {
    await appendJobEvent({
      jobId: id,
      eventType: "snapshot",
      data: { job: toJobSnapshot(job) },
    });
  }
  return job;
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
  const job = await updateJobRunProgress({ id, phase, current, total, label });
  if (job) {
    await appendJobEvent({
      jobId: id,
      eventType: "progress",
      data: { job: toJobSnapshot(job) },
    });
  }
  return job;
}

export async function completeJobRun({
  id,
  result,
}: {
  id: string;
  result?: Record<string, unknown> | null;
}): Promise<JobRunRecord | null> {
  const job = await markJobRunCompleted({ id, result });
  if (job) {
    await appendJobEvent({
      jobId: id,
      eventType: "complete",
      data: { job: toJobSnapshot(job) },
    });
  }
  return job;
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
  const job = await markJobRunFailed({ id, errorCode, errorMessage });
  if (job) {
    await appendJobEvent({
      jobId: id,
      eventType: "failed",
      data: { job: toJobSnapshot(job) },
    });
  }
  return job;
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
