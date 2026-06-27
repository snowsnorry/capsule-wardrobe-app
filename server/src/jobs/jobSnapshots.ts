import type { JobRunRecord, JobSnapshot } from "./types.js";

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function requireIsoString(value: string | Date | null | undefined): string {
  return toIsoString(value) || new Date(0).toISOString();
}

export function toJobSnapshot(row: JobRunRecord): JobSnapshot {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    phase: row.phase,
    progress: {
      current: row.progressCurrent,
      total: row.progressTotal,
      label: row.progressLabel,
    },
    entity: row.entityType
      ? {
          type: row.entityType,
          id: row.entityId,
        }
      : null,
    result: row.result,
    error: row.errorCode
      ? {
          code: row.errorCode,
          message: row.errorMessage,
        }
      : null,
    createdAt: requireIsoString(row.createdAt),
    updatedAt: requireIsoString(row.updatedAt),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    failedAt: toIsoString(row.failedAt),
  };
}
