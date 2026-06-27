import type { EnqueueJobInput, JobSnapshot } from "../jobs/types.js";

function sendQueuedJob(res, job: JobSnapshot) {
  return res.status(202).json({ ok: true, job });
}

async function enqueueRouteJob(context, input: EnqueueJobInput) {
  const enqueue = context.enqueueJobImpl as
    | ((input: EnqueueJobInput) => Promise<JobSnapshot>)
    | undefined;
  if (!enqueue) {
    throw new Error("job_queue_unavailable");
  }
  return enqueue(input);
}

export { enqueueRouteJob, sendQueuedJob };
