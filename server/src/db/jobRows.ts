import type {
  JobEntityType,
  JobEventRecord,
  JobKind,
  JobPayload,
  JobRunRecord,
  JobStatus,
} from "../jobs/types.js";
import { toJobSnapshot } from "../jobs/jobSnapshots.js";

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

function normalizeJobEventData(value: unknown): Record<string, unknown> {
  const data = parseJsonObject(value);
  const jobRun = data.jobRun;
  if (!jobRun || typeof jobRun !== "object" || Array.isArray(jobRun)) {
    return data;
  }

  const { jobRun: _jobRun, ...rest } = data;
  return {
    ...rest,
    job: toJobSnapshot(toJobRunRecord(jobRun as JobRunRow)),
  };
}

function toJobEventRecord(row: JobEventRow): JobEventRecord {
  return {
    id: Number(row.id),
    jobId: String(row.job_id),
    eventType: String(row.event_type || ""),
    data: normalizeJobEventData(row.data),
    createdAt: requireIsoString(row.created_at),
  };
}

export { normalizeEmail, parseJsonObject, toJobEventRecord, toJobRunRecord };
export type { JobEventRow, JobRunRow };
