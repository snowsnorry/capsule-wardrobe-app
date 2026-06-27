import crypto from "node:crypto";
import type { EnqueueJobInput, JobSnapshot, JobStatus } from "./types.js";

function now() {
  return new Date().toISOString();
}

function toSnapshot(input: EnqueueJobInput, id: string): JobSnapshot {
  const timestamp = now();
  return {
    id,
    kind: input.kind,
    status: "queued",
    phase: input.phase || "queued",
    progress: {
      current: 0,
      total: input.progressTotal ?? null,
      label: input.progressLabel || null,
    },
    entity: input.entity || null,
    result: null,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: null,
    completedAt: null,
    failedAt: null,
  };
}

function isActive(job: JobSnapshot) {
  return job.status === "queued" || job.status === "running";
}

function normalizeEmail(email: unknown) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function createInMemoryJobService() {
  const jobs = new Map<string, JobSnapshot>();
  const owners = new Map<string, string>();
  const dedupe = new Map<string, string>();

  return {
    clearJobRunsForEmailImpl: async (email: string) => {
      const normalizedEmail = normalizeEmail(email);
      let deleted = 0;
      for (const [id, owner] of owners.entries()) {
        if (owner !== normalizedEmail) continue;
        jobs.delete(id);
        owners.delete(id);
        deleted += 1;
      }
      for (const [key, id] of dedupe.entries()) {
        if (!jobs.has(id)) {
          dedupe.delete(key);
        }
      }
      return deleted;
    },
    enqueueJobImpl: async (input: EnqueueJobInput) => {
      const profileEmail = normalizeEmail(input.profileEmail);
      const dedupeKey = `${profileEmail}:${input.kind}:${input.dedupeKey || ""}`;
      const existingId = input.dedupeKey ? dedupe.get(dedupeKey) : "";
      const existing = existingId ? jobs.get(existingId) : null;
      if (existing && isActive(existing)) {
        return existing;
      }

      const job = toSnapshot(input, crypto.randomUUID());
      jobs.set(job.id, job);
      owners.set(job.id, profileEmail);
      if (input.dedupeKey) {
        dedupe.set(dedupeKey, job.id);
      }
      return job;
    },
    getJobSnapshotImpl: async ({ id, email }: { id: string; email: string }) =>
      owners.get(id) === normalizeEmail(email) ? jobs.get(id) || null : null,
    listJobSnapshotsImpl: async ({
      email,
      status,
    }: {
      email: string;
      status?: "active" | JobStatus | null;
    }) =>
      Array.from(jobs.values()).filter((job) => {
        if (owners.get(job.id) !== normalizeEmail(email)) {
          return false;
        }
        return status === "active"
          ? isActive(job)
          : status
            ? job.status === status
            : true;
      }),
    listJobEventsAfterImpl: async () => [],
    startJobWorkersImpl: async () => {},
    stopJobWorkersImpl: async () => {},
  };
}
