import { getFirstRow, getSqlClient, type SqlClientLike } from "./core.js";
import type { EnqueueJobInput, JobKind, JobRunRecord } from "../jobs/types.js";
import { normalizeEmail, toJobRunRecord, type JobRunRow } from "./jobRows.js";
import { recordRejectionMetric } from "../observabilityMetrics.js";

const ACTIVE_TOTAL_JOB_CAP = 8;
const ACTIVE_GENERATION_JOB_CAP = 4;
const ACTIVE_UPLOAD_JOB_CAP = 2;
const ACTIVE_REPORT_KIND_CAP = 1;
const UPLOAD_JOB_KINDS = new Set<JobKind>([
  "personalItemUploadFiles",
  "personalItemUploadUrls",
]);
const REPORT_JOB_KINDS = new Set<JobKind>([
  "capsuleReportGenerate",
  "outfitReportGenerate",
  "personalItemsReportGenerate",
]);
const GENERATION_JOB_KINDS = new Set<JobKind>([
  "capsuleGenerate",
  "capsuleRegenerateSelected",
  "capsuleReportGenerate",
  "outfitImageGenerate",
  "outfitReportGenerate",
  "outfitSetImageGenerate",
  "personalItemsReportGenerate",
]);

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

function toCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function createTooManyActiveJobsError(): Error & { code: string } {
  const error = new Error("too_many_active_jobs") as Error & { code: string };
  error.code = "too_many_active_jobs";
  return error;
}

async function getActiveJobCapCounts({
  sql,
  profileEmail,
  kind,
}: {
  sql: SqlClientLike;
  profileEmail: string;
  kind: JobKind;
}) {
  const row = getFirstRow(
    await sql<{
      total_count: string | number;
      generation_count: string | number;
      upload_count: string | number;
      report_kind_count: string | number;
    }>`
      select
        count(*) as total_count,
        count(*) filter (
          where kind = any(${Array.from(GENERATION_JOB_KINDS)})
        ) as generation_count,
        count(*) filter (
          where kind = any(${Array.from(UPLOAD_JOB_KINDS)})
        ) as upload_count,
        count(*) filter (
          where kind = ${kind}
            and kind = any(${Array.from(REPORT_JOB_KINDS)})
        ) as report_kind_count
      from job_runs
      where profile_email = ${profileEmail}
        and status in ('queued', 'running')
    `,
  );
  return {
    total: toCount(row?.total_count),
    generation: toCount(row?.generation_count),
    upload: toCount(row?.upload_count),
    reportKind: toCount(row?.report_kind_count),
  };
}

async function assertActiveJobCapacity({
  sql,
  profileEmail,
  kind,
}: {
  sql: SqlClientLike;
  profileEmail: string;
  kind: JobKind;
}) {
  const counts = await getActiveJobCapCounts({ sql, profileEmail, kind });
  const isUpload = UPLOAD_JOB_KINDS.has(kind);
  const isGeneration = GENERATION_JOB_KINDS.has(kind);
  const isReport = REPORT_JOB_KINDS.has(kind);
  if (
    counts.total >= ACTIVE_TOTAL_JOB_CAP ||
    (isUpload && counts.upload >= ACTIVE_UPLOAD_JOB_CAP) ||
    (isGeneration && counts.generation >= ACTIVE_GENERATION_JOB_CAP) ||
    (isReport && counts.reportKind >= ACTIVE_REPORT_KIND_CAP)
  ) {
    recordRejectionMetric(`active_cap:job:${kind}`);
    throw createTooManyActiveJobsError();
  }
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

  await assertActiveJobCapacity({ sql, profileEmail, kind: input.kind });

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
