import { getSqlClient } from "./core.js";
import type { JobKind, JobMetrics, JobStatus } from "../jobs/types.js";
import {
  addJobMetricCount,
  createEmptyJobMetrics,
} from "../jobs/jobMetrics.js";

type JobMetricCountRow = {
  kind: string;
  status: string;
  count: number | string;
};

type JobStuckMetricRow = {
  status: string;
  count: number | string;
};

export async function getJobRunMetrics({
  queuedStuckMs,
  runningStuckMs,
}: {
  queuedStuckMs: number;
  runningStuckMs: number;
}): Promise<JobMetrics> {
  const sql = getSqlClient();
  const metrics = createEmptyJobMetrics();
  const [countsResult, stuckCountsResult] = await Promise.all([
    sql<JobMetricCountRow>`
      select kind, status, count(*)::int as count
      from job_runs
      group by kind, status
    `,
    sql<JobStuckMetricRow>`
      select status, count(*)::int as count
      from job_runs
      where (
          status = 'queued'
          and updated_at <= now() - (${Math.max(0, queuedStuckMs)} * interval '1 millisecond')
        )
        or (
          status = 'running'
          and updated_at <= now() - (${Math.max(0, runningStuckMs)} * interval '1 millisecond')
        )
      group by status
    `,
  ]);

  const counts = Array.isArray(countsResult) ? countsResult : [];
  const stuckCounts = Array.isArray(stuckCountsResult) ? stuckCountsResult : [];

  for (const row of counts) {
    addJobMetricCount({
      count: Number(row.count) || 0,
      kind: row.kind as JobKind,
      metrics,
      status: row.status as JobStatus,
    });
  }
  for (const row of stuckCounts) {
    const count = Number(row.count) || 0;
    if (row.status === "queued") {
      metrics.stuck.queued += count;
    }
    if (row.status === "running") {
      metrics.stuck.running += count;
    }
    metrics.stuck.total += count;
  }
  return metrics;
}
