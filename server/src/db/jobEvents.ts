import { getFirstRow, getSqlClient } from "./core.js";
import type { JobEventRecord } from "../jobs/types.js";
import { toJobEventRecord, type JobEventRow } from "./jobRows.js";

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
