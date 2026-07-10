import { getFirstRow, getSqlClient } from "./core.js";
import type { JobEventRecord } from "../jobs/types.js";
import {
  normalizeEmail,
  toJobEventRecord,
  type JobEventRow,
} from "./jobRows.js";

export async function appendJobEvent({
  jobId,
  eventType,
  data,
}: {
  jobId: string;
  eventType: string;
  data?: Record<string, unknown> | null;
}): Promise<JobEventRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobEventRow>`
      insert into job_events (job_id, event_type, data)
      values (${jobId}, ${eventType}, ${JSON.stringify(data || {})}::jsonb)
      returning *
    `,
  );
  return row ? toJobEventRecord(row) : null;
}

export async function listJobEventsAfter({
  jobId,
  afterId,
}: {
  jobId: string;
  afterId?: number | null;
}): Promise<JobEventRecord[]> {
  const sql = getSqlClient();
  const rows = await sql<JobEventRow>`
    select * from job_events
    where job_id = ${jobId}
      and id > ${Number(afterId) || 0}
    order by id asc
    limit 100
  `;
  return Array.isArray(rows) ? rows.map(toJobEventRecord) : [];
}

export async function getLatestOwnedJobEventId(email: string): Promise<number> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<{ id: number | string | null }>`
      select max(job_events.id) as id
      from job_events
      inner join job_runs on job_runs.id = job_events.job_id
      where job_runs.profile_email = ${normalizeEmail(email)}
    `,
  );
  return Number(row?.id) || 0;
}

export async function listOwnedJobEventsAfter({
  email,
  afterId,
  limit = 100,
}: {
  email: string;
  afterId?: number | null;
  limit?: number;
}): Promise<JobEventRecord[]> {
  const sql = getSqlClient();
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  const rows = await sql<JobEventRow>`
    select job_events.*
    from job_events
    inner join job_runs on job_runs.id = job_events.job_id
    where job_runs.profile_email = ${normalizeEmail(email)}
      and job_events.id > ${Number(afterId) || 0}
    order by job_events.id asc
    limit ${normalizedLimit}
  `;
  return Array.isArray(rows) ? rows.map(toJobEventRecord) : [];
}
