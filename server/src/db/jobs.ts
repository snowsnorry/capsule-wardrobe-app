import { getFirstRow, getSqlClient, type SqlClientLike } from "./core.js";
import type {
  EnqueueJobInput,
  JobEventRecord,
  JobKind,
  JobMetrics,
  JobPayload,
  JobRunRecord,
  JobStatus,
} from "../jobs/types.js";
import {
  addJobMetricCount,
  createEmptyJobMetrics,
} from "../jobs/jobMetrics.js";
import {
  cleanupStagedUploadFiles,
  type StagedUploadFile,
} from "../jobs/stagedUploadStorage.js";
import {
  normalizeEmail,
  parseJsonObject,
  toJobEventRecord,
  toJobRunRecord,
  type JobEventRow,
  type JobRunRow,
} from "./jobRows.js";

type JobMetricCountRow = {
  kind: string;
  status: string;
  count: number | string;
};

type JobStuckMetricRow = {
  status: string;
  count: number | string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    (error as { code?: string } | null)?.code === "23505" ||
    String((error as Error | null)?.message || "").includes("23505")
  );
}

async function findActiveDedupeJob({
  sql,
  profileEmail,
  kind,
  dedupeKey,
}: {
  sql: SqlClientLike;
  profileEmail: string;
  kind: JobKind;
  dedupeKey?: string | null;
}) {
  if (!dedupeKey) {
    return null;
  }

  const row = getFirstRow(
    await sql<JobRunRow>`
      select * from job_runs
      where profile_email = ${profileEmail}
        and kind = ${kind}
        and dedupe_key = ${dedupeKey}
        and status in ('queued', 'running')
      order by created_at asc
      limit 1
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

// eslint-disable-next-line complexity
export async function createJobRun(
  input: EnqueueJobInput,
): Promise<{ job: JobRunRecord; deduped: boolean }> {
  const sql = getSqlClient();
  const profileEmail = normalizeEmail(input.profileEmail);
  const dedupeKey = String(input.dedupeKey || "").trim() || null;
  const active = await findActiveDedupeJob({
    sql,
    profileEmail,
    kind: input.kind,
    dedupeKey,
  });
  if (active) {
    return { job: active, deduped: true };
  }

  try {
    const row = getFirstRow(
      await sql<JobRunRow>`
        with inserted as (
          insert into job_runs (
            profile_email,
            kind,
            entity_type,
            entity_id,
            dedupe_key,
            status,
            phase,
            progress_total,
            progress_label,
            payload
          )
          values (
            ${profileEmail},
            ${input.kind},
            ${input.entity?.type || null},
            ${input.entity?.id || null},
            ${dedupeKey},
            'queued',
            ${input.phase || "queued"},
            ${input.progressTotal ?? null},
            ${input.progressLabel || null},
            ${JSON.stringify(input.payload || {})}::jsonb
          )
          returning *
        ),
        event as (
          insert into job_events (job_id, event_type, data)
          select id, 'snapshot', jsonb_build_object('jobRun', to_jsonb(inserted))
          from inserted
        )
        select * from inserted
      `,
    );
    if (!row) {
      throw new Error("job_create_failed");
    }
    return { job: toJobRunRecord(row), deduped: false };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const deduped = await findActiveDedupeJob({
      sql,
      profileEmail,
      kind: input.kind,
      dedupeKey,
    });
    if (!deduped) {
      throw error;
    }
    return { job: deduped, deduped: true };
  }
}

export async function setJobRunProviderJobId({
  id,
  providerJobId,
}: {
  id: string;
  providerJobId: string;
}): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      update job_runs
      set provider_job_id = ${providerJobId}, updated_at = now()
      where id = ${id}
      returning *
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function claimQueuedJobRunsWithoutProviderId({
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
      where status = 'queued'
        and provider_job_id is null
        and updated_at <= now() - (${Math.max(0, staleMs)} * interval '1 millisecond')
      order by updated_at asc
      limit ${Math.max(1, limit)}
      for update skip locked
    ),
    claimed as (
      update job_runs
      set updated_at = now()
      where id in (select id from due)
      returning *
    )
    select * from claimed
  `;
  return Array.isArray(rows) ? rows.map(toJobRunRecord) : [];
}

export async function getJobRunByIdForEmail({
  id,
  email,
}: {
  id: string;
  email: string;
}): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      select * from job_runs
      where id = ${id}
        and profile_email = ${normalizeEmail(email)}
      limit 1
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function getJobRunById(id: string): Promise<JobRunRecord | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<JobRunRow>`
      select * from job_runs
      where id = ${id}
      limit 1
    `,
  );
  return row ? toJobRunRecord(row) : null;
}

export async function listJobRunsForEmail({
  email,
  status,
}: {
  email: string;
  status?: "active" | JobStatus | null;
}): Promise<JobRunRecord[]> {
  const sql = getSqlClient();
  const normalizedEmail = normalizeEmail(email);
  const rows =
    status === "active"
      ? await sql<JobRunRow>`
          select * from job_runs
          where profile_email = ${normalizedEmail}
            and status in ('queued', 'running')
          order by created_at desc
          limit 50
        `
      : status
        ? await sql<JobRunRow>`
            select * from job_runs
            where profile_email = ${normalizedEmail}
              and status = ${status}
            order by created_at desc
            limit 50
          `
        : await sql<JobRunRow>`
            select * from job_runs
            where profile_email = ${normalizedEmail}
            order by created_at desc
            limit 50
          `;
  return Array.isArray(rows) ? rows.map(toJobRunRecord) : [];
}

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

export async function clearJobRunsForEmail(email: string): Promise<number> {
  const sql = getSqlClient();
  const result = await sql<{
    id: string;
    payload?: JobPayload | string | null;
  }>`
    delete from job_runs
    where profile_email = ${normalizeEmail(email)}
    returning id, payload
  `;
  if (!Array.isArray(result)) {
    return 0;
  }
  const stagedFiles = result.flatMap((row) => {
    const payload = parseJsonObject(row.payload);
    return Array.isArray(payload.stagedFiles)
      ? (payload.stagedFiles as StagedUploadFile[])
      : [];
  });
  await cleanupStagedUploadFiles(stagedFiles);
  return result.length;
}

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
