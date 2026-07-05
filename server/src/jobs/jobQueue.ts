import { createPgBossQueueBackend } from "./pgBossQueueBackend.js";
import {
  claimPendingProviderJobs,
  createPendingJob,
  failStaleRunningJobs,
  failJobRun,
  setProviderJobId,
} from "./jobStore.js";
import { JOB_RUN_TIMEOUT_MS } from "../appConfig.js";
import type { QueueBackend } from "./queueBackend.js";
import type { EnqueueJobInput, JobRunRecord, JobSnapshot } from "./types.js";

const PROVIDER_RECONCILE_STALE_MS = 30_000;
const PROVIDER_RECONCILE_LIMIT = 25;
const RUNNING_RECONCILE_LIMIT = 50;

export type JobQueue = {
  enqueue: (input: EnqueueJobInput) => Promise<JobSnapshot>;
  reconcileStaleRunningJobs: () => Promise<{ failed: number }>;
  reconcilePendingProviderJobs: () => Promise<{
    failed: number;
    reenqueued: number;
  }>;
  backend: QueueBackend;
};

async function enqueueProviderJob({
  backend,
  job,
}: {
  backend: QueueBackend;
  job: Pick<JobRunRecord, "id" | "kind" | "payload">;
}) {
  const providerJobId = await backend.enqueue({
    jobId: job.id,
    kind: job.kind,
    payload: job.payload,
  });
  if (providerJobId) {
    await setProviderJobId(job.id, providerJobId);
  }
}

export function createJobQueue({
  backend = createPgBossQueueBackend(),
}: {
  backend?: QueueBackend;
} = {}): JobQueue {
  return {
    backend,
    async enqueue(input) {
      const { job, snapshot, deduped } = await createPendingJob(input);
      if (deduped) {
        return snapshot;
      }

      try {
        await enqueueProviderJob({ backend, job });
      } catch (error) {
        await failJobRun({
          id: job.id,
          errorCode: "queue_unavailable",
          errorMessage: String((error as Error | null)?.message || error),
        });
        throw error;
      }

      return snapshot;
    },
    async reconcilePendingProviderJobs() {
      const jobs = await claimPendingProviderJobs({
        staleMs: PROVIDER_RECONCILE_STALE_MS,
        limit: PROVIDER_RECONCILE_LIMIT,
      });
      let failed = 0;
      let reenqueued = 0;
      for (const job of jobs) {
        try {
          await enqueueProviderJob({ backend, job });
          reenqueued += 1;
        } catch (error) {
          failed += 1;
          await failJobRun({
            id: job.id,
            errorCode: "queue_unavailable",
            errorMessage: String((error as Error | null)?.message || error),
          });
        }
      }
      return { failed, reenqueued };
    },
    async reconcileStaleRunningJobs() {
      const jobs = await failStaleRunningJobs({
        staleMs: JOB_RUN_TIMEOUT_MS,
        limit: RUNNING_RECONCILE_LIMIT,
      });
      return { failed: jobs.length };
    },
  };
}
