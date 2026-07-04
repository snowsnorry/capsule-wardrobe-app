import { getFirstRow, getSqlClient, type SqlClientLike } from "./core.js";
import type { EnqueueJobInput, JobKind, JobRunRecord } from "../jobs/types.js";
import { normalizeEmail, toJobRunRecord, type JobRunRow } from "./jobRows.js";

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
