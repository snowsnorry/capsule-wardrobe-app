import { createPgBossQueueBackend } from "./pgBossQueueBackend.js";
import { createPendingJob, failJobRun, setProviderJobId } from "./jobStore.js";
import type { QueueBackend } from "./queueBackend.js";
import type { EnqueueJobInput, JobSnapshot } from "./types.js";

export type JobQueue = {
  enqueue: (input: EnqueueJobInput) => Promise<JobSnapshot>;
  backend: QueueBackend;
};

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
        const providerJobId = await backend.enqueue({
          jobId: job.id,
          kind: job.kind,
          payload: job.payload,
        });
        if (providerJobId) {
          await setProviderJobId(job.id, providerJobId);
        }
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
  };
}
