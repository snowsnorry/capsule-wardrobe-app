import type { JobKind, JobMetrics, JobStatus } from "./types.js";

const JOB_STATUSES: JobStatus[] = ["queued", "running", "completed", "failed"];

function createStatusCounts(): Record<JobStatus, number> {
  return {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
}

export function createEmptyJobMetrics(): JobMetrics {
  return {
    total: 0,
    byStatus: createStatusCounts(),
    byKind: {},
    stuck: {
      total: 0,
      queued: 0,
      running: 0,
    },
  };
}

export function addJobMetricCount({
  count,
  kind,
  metrics,
  status,
}: {
  count: number;
  kind: JobKind;
  metrics: JobMetrics;
  status: JobStatus;
}): void {
  if (!JOB_STATUSES.includes(status)) {
    return;
  }
  metrics.total += count;
  metrics.byStatus[status] += count;
  metrics.byKind[kind] ??= createStatusCounts();
  metrics.byKind[kind][status] += count;
}
