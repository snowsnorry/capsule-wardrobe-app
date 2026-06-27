import { getFirstRow, getSqlClient, type SqlClientLike } from "./core.js";
import type {
  EnqueueJobInput,
  JobEntityType,
  JobEventRecord,
  JobKind,
  JobPayload,
  JobRunRecord,
  JobStatus,
} from "../jobs/types.js";
import {
  cleanupStagedUploadFiles,
  type StagedUploadFile,
} from "../jobs/stagedUploadStorage.js";

type JobRunRow = {
  id: string;
  provider_job_id: string | null;
  profile_email: string;
  kind: string;
  entity_type: string | null;
  entity_id: string | null;
  dedupe_key: string | null;
  status: string;
  phase: string | null;
  progress_current: number | string | null;
  progress_total: number | string | null;
  progress_label: string | null;
  payload: JobPayload | string | null;
  result: Record<string, unknown> | string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  failed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  expires_at: string | Date | null;
};

type JobEventRow = {
  id: number | string;
  job_id: string;
  event_type: string;
  data: Record<string, unknown> | string | null;
  created_at: string | Date;
};

const ACTIVE_STATUSES = ["queued", "running"] as const;

function normalizeEmail(email: unknown): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toNullableJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  const parsed = parseJsonObject(value);
  return Object.keys(parsed).length > 0 ? parsed : null;
}

function toIsoString(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function requireIsoString(value: string | Date): string {
  return toIsoString(value) || new Date(0).toISOString();
}

function toJobRunRecord(row: JobRunRow): JobRunRecord {
  return {
    id: String(row.id),
    providerJobId: row.provider_job_id,
    profileEmail: row.profile_email,
    kind: row.kind as JobKind,
    entityType: row.entity_type as JobEntityType | null,
    entityId: row.entity_id,
    dedupeKey: row.dedupe_key,
    status: row.status as JobStatus,
    phase: row.phase,
    progressCurrent: Number(row.progress_current) || 0,
    progressTotal:
      row.progress_total === null || row.progress_total === undefined
        ? null
        : Number(row.progress_total),
    progressLabel: row.progress_label,
    payload: parseJsonObject(row.payload),
    result: toNullableJsonObject(row.result),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
    failedAt: toIsoString(row.failed_at),
    createdAt: requireIsoString(row.created_at),
    updatedAt: requireIsoString(row.updated_at),
    expiresAt: toIsoString(row.expires_at),
  };
}

function toJobEventRecord(row: JobEventRow): JobEventRecord {
  return {
    id: Number(row.id),
    jobId: String(row.job_id),
    eventType: String(row.event_type || ""),
    data: parseJsonObject(row.data),
    createdAt: requireIsoString(row.created_at),
  };
}

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
      update job_runs
      set
        status = 'running',
        phase = coalesce(nullif(phase, 'queued'), 'running'),
        started_at = coalesce(started_at, now()),
        updated_at = now()
      where id = ${id}
        and status = 'queued'
      returning *
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

export { ACTIVE_STATUSES };
