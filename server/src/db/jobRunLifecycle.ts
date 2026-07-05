import { getFirstRow, getSqlClient } from "./core.js";
import type { JobRunRecord } from "../jobs/types.js";
import { toJobRunRecord, type JobRunRow } from "./jobRows.js";

export async function markJobRunStarted(
  id: string,
): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      with updated as (
        update job_runs
        set
          status = 'running',
          phase = coalesce(nullif(phase, 'queued'), 'running'),
          started_at = coalesce(started_at, now()),
          updated_at = now()
        where id = ${id}
          and status = 'queued'
        returning *
      ),
      event as (
        insert into job_events (job_id, event_type, data)
        select id, 'snapshot', jsonb_build_object('jobRun', to_jsonb(updated))
        from updated
      )
      select * from updated
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function updateJobRunProgress({
  id,
  phase,
  current,
  total,
  label,
}: {
  id: string;
  phase?: string | null;
  current?: number;
  total?: number | null;
  label?: string | null;
}): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      with updated as (
        update job_runs
        set
          phase = coalesce(${phase ?? null}, phase),
          progress_current = coalesce(${current ?? null}, progress_current),
          progress_total = coalesce(${total === undefined ? null : total}, progress_total),
          progress_label = coalesce(${label ?? null}, progress_label),
          updated_at = now()
        where id = ${id}
          and status = 'running'
        returning *
      ),
      event as (
        insert into job_events (job_id, event_type, data)
        select id, 'progress', jsonb_build_object('jobRun', to_jsonb(updated))
        from updated
      )
      select * from updated
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function markJobRunCompleted({
  id,
  result,
}: {
  id: string;
  result?: Record<string, unknown> | null;
}): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      with updated as (
        update job_runs
        set
          status = 'completed',
          phase = 'complete',
          result = ${JSON.stringify(result || {})}::jsonb,
          completed_at = now(),
          updated_at = now()
        where id = ${id}
          and status = 'running'
        returning *
      ),
      event as (
        insert into job_events (job_id, event_type, data)
        select id, 'complete', jsonb_build_object('jobRun', to_jsonb(updated))
        from updated
      )
      select * from updated
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function markJobRunFailed({
  id,
  errorCode,
  errorMessage,
}: {
  id: string;
  errorCode: string;
  errorMessage?: string | null;
}): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      with updated as (
        update job_runs
        set
          status = 'failed',
          phase = 'failed',
          error_code = ${errorCode},
          error_message = ${errorMessage || null},
          failed_at = now(),
          updated_at = now()
        where id = ${id}
          and status in ('queued', 'running')
        returning *
      ),
      event as (
        insert into job_events (job_id, event_type, data)
        select id, 'failed', jsonb_build_object('jobRun', to_jsonb(updated))
        from updated
      )
      select * from updated
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function markStaleRunningJobRunsFailed({
  staleMs,
  limit,
}: {
  staleMs: number;
  limit: number;
}): Promise<JobRunRecord[]> {
  const sql = getSqlClient();
  const rows = await sql<JobRunRow>`
    with due as (
      select id
      from job_runs
      where status = 'running'
        and updated_at <= now() - (${Math.max(0, staleMs)} * interval '1 millisecond')
      order by updated_at asc
      limit ${Math.max(1, limit)}
      for update skip locked
    ),
    updated as (
      update job_runs
      set
        status = 'failed',
        phase = 'failed',
        error_code = 'job_stale_after_crash',
        error_message = 'Job was running before worker recovery and exceeded its deadline.',
        failed_at = now(),
        updated_at = now()
      where id in (select id from due)
      returning *
    ),
    event as (
      insert into job_events (job_id, event_type, data)
      select id, 'failed', jsonb_build_object('jobRun', to_jsonb(updated))
      from updated
    )
    select * from updated
  `;
  return Array.isArray(rows) ? rows.map(toJobRunRecord) : [];
}
