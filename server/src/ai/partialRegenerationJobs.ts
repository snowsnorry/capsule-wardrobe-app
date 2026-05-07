import type { PartialRegenerationJobState } from "./types.js";

const COMPLETED_PARTIAL_REGENERATION_JOB_TTL_MS = 5 * 60 * 1000;
const partialRegenerationJobs = new Map<string, PartialRegenerationJobState>();

function createPartialRegenerationJobKey(email: string, capsuleId: string) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return normalizedCapsuleId
    ? `${normalizedEmail}::${normalizedCapsuleId}`
    : normalizedEmail;
}

function getPartialRegenerationJobFromStore({
  email,
  capsuleId,
  jobs = partialRegenerationJobs,
  nowMs = Date.now(),
  completedJobTtlMs = COMPLETED_PARTIAL_REGENERATION_JOB_TTL_MS,
}: {
  email: string;
  capsuleId: string;
  jobs?: Map<string, PartialRegenerationJobState>;
  nowMs?: number;
  completedJobTtlMs?: number;
}) {
  const jobKey = createPartialRegenerationJobKey(email, capsuleId);
  const job = jobs.get(jobKey);
  if (!job) {
    return null;
  }

  if (job.status !== "pending" && nowMs - job.updatedAt > completedJobTtlMs) {
    jobs.delete(jobKey);
    return null;
  }

  return job;
}

function getPartialRegenerationJob(email: string, capsuleId: string) {
  return getPartialRegenerationJobFromStore({ email, capsuleId });
}

export {
  createPartialRegenerationJobKey,
  getPartialRegenerationJob,
  getPartialRegenerationJobFromStore,
  partialRegenerationJobs,
};
