import type { WardrobePdfJobState } from "./ai/types.js";
import { PDF_JOB_TTL_MS } from "./wardrobePdfCore.js";

const wardrobePdfJobs = new Map<string, WardrobePdfJobState>();

export function scheduleWardrobePdfJobCleanup(
  email: string,
  job: WardrobePdfJobState,
) {
  const timer = setTimeout(() => {
    if (isCurrentWardrobePdfJob(email, job) && job.status !== "pending") {
      wardrobePdfJobs.delete(email);
    }
  }, PDF_JOB_TTL_MS);
  timer.unref?.();
}

export function getWardrobePdfJob(email: string) {
  const job = wardrobePdfJobs.get(email);
  if (!job) {
    return null;
  }

  if (job.status !== "pending" && Date.now() - job.updatedAt > PDF_JOB_TTL_MS) {
    wardrobePdfJobs.delete(email);
    return null;
  }

  return job;
}

export function setWardrobePdfJob(email: string, job: WardrobePdfJobState) {
  wardrobePdfJobs.set(email, job);
}

export function deleteWardrobePdfJob(email: string) {
  wardrobePdfJobs.delete(email);
}

export function isCurrentWardrobePdfJob(
  email: string,
  job: WardrobePdfJobState,
) {
  return wardrobePdfJobs.get(email) === job;
}
