import {
  E2E_SERVER,
  JOB_QUEUE_BACKEND,
  JOB_WORKER_ENABLED,
  NODE_ENV,
} from "./appConfig.js";
import { createInMemoryJobService } from "./jobs/inMemoryJobService.js";
import { createJobQueue } from "./jobs/jobQueue.js";
import {
  getJobMetrics,
  getOwnedJobSnapshot,
  listActiveJobsForEntity,
  listActiveJobSnapshotsForEntity,
  listOwnedJobSnapshots,
  replayJobEvents,
} from "./jobs/jobStore.js";
import { createJobWorker } from "./jobs/jobWorker.js";

export function createJobDependencies(deps: Record<string, unknown>) {
  if (NODE_ENV === "test" || E2E_SERVER) {
    return createInMemoryJobService();
  }
  if (JOB_QUEUE_BACKEND !== "pg_boss") {
    throw new Error(`unsupported_job_queue_backend:${JOB_QUEUE_BACKEND}`);
  }

  const queue = createJobQueue();
  const worker = createJobWorker({
    backend: queue.backend,
    deps,
    enabled: JOB_WORKER_ENABLED,
    reconcilePendingProviderJobs: queue.reconcilePendingProviderJobs,
    reconcileStaleRunningJobs: queue.reconcileStaleRunningJobs,
  });
  return {
    enqueueJobImpl: queue.enqueue,
    getJobMetricsImpl: getJobMetrics,
    getJobSnapshotImpl: getOwnedJobSnapshot,
    listActiveJobsForEntityImpl: listActiveJobsForEntity,
    listActiveJobSnapshotsForEntityImpl: listActiveJobSnapshotsForEntity,
    listJobEventsAfterImpl: replayJobEvents,
    listJobSnapshotsImpl: listOwnedJobSnapshots,
    startJobWorkersImpl: worker.start,
    stopJobWorkersImpl: worker.stop,
  };
}
