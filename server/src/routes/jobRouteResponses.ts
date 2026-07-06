import type { EnqueueJobInput, JobSnapshot } from "../jobs/types.js";

function sendQueuedJob(res, job: JobSnapshot) {
  return res.status(202).json({ ok: true, job });
}

function isTooManyActiveJobsError(error: unknown) {
  return (error as { code?: string } | null)?.code === "too_many_active_jobs";
}

function sendJobEnqueueError(res, error: unknown) {
  if (isTooManyActiveJobsError(error)) {
    return res.status(429).json({ error: "too_many_active_jobs" });
  }
  return null;
}

async function enqueueRouteJob(context, input: EnqueueJobInput) {
  const enqueue = context.enqueueJobImpl as
    ((input: EnqueueJobInput) => Promise<JobSnapshot>) | undefined;
  if (!enqueue) {
    throw new Error("job_queue_unavailable");
  }
  return enqueue(input);
}

export { enqueueRouteJob, sendJobEnqueueError, sendQueuedJob };
