import { getFirstRow, getSqlClient } from "./core.js";
import type { JobRunRecord, JobStatus } from "../jobs/types.js";
import { normalizeEmail, toJobRunRecord, type JobRunRow } from "./jobRows.js";

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

export async function listActiveJobRunsForEntity({
  email,
  entityType,
  entityId,
  kinds,
}: {
  email: string;
  entityType: string;
  entityId?: string | null;
  kinds?: string[] | null;
}): Promise<JobRunRecord[]> {
  const sql = getSqlClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedKinds = Array.isArray(kinds)
    ? kinds.map((kind) => String(kind || "").trim()).filter(Boolean)
    : [];
  const normalizedEntityId = String(entityId || "").trim();
  const rows =
    normalizedKinds.length > 0
      ? await sql<JobRunRow>`
          select * from job_runs
          where profile_email = ${normalizedEmail}
            and entity_type = ${entityType}
            and (${normalizedEntityId || null}::text is null or entity_id = ${normalizedEntityId || null})
            and kind = any(${normalizedKinds})
            and status in ('queued', 'running')
          order by created_at desc
          limit 50
        `
      : await sql<JobRunRow>`
          select * from job_runs
          where profile_email = ${normalizedEmail}
            and entity_type = ${entityType}
            and (${normalizedEntityId || null}::text is null or entity_id = ${normalizedEntityId || null})
            and status in ('queued', 'running')
          order by created_at desc
          limit 50
        `;
  return Array.isArray(rows) ? rows.map(toJobRunRecord) : [];
}
