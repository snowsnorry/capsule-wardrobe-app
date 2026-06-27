import { expect, test } from "vitest";
import { toJobSnapshot } from "./jobSnapshots.js";
import type { JobRunRecord } from "./types.js";

test("toJobSnapshot exposes only public job fields with normalized timestamps", () => {
  const snapshot = toJobSnapshot({
    id: "job-1",
    providerJobId: "provider-1",
    profileEmail: "person@example.com",
    kind: "outfitReportGenerate",
    entityType: "outfit",
    entityId: "outfit-1",
    dedupeKey: "dedupe-1",
    status: "failed",
    phase: "failed",
    progressCurrent: 2,
    progressTotal: 3,
    progressLabel: "Analyzing",
    payload: { outfitId: "outfit-1" },
    result: null,
    errorCode: "llm_failed",
    errorMessage: "Model failed",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: null,
    failedAt: "2026-01-01T00:01:00.000Z",
    createdAt: "not-a-date",
    updatedAt: new Date("2026-01-01T00:02:00.000Z"),
    expiresAt: null,
  } as unknown as JobRunRecord);

  expect(snapshot).toEqual({
    id: "job-1",
    kind: "outfitReportGenerate",
    status: "failed",
    phase: "failed",
    progress: {
      current: 2,
      total: 3,
      label: "Analyzing",
    },
    entity: {
      type: "outfit",
      id: "outfit-1",
    },
    result: null,
    error: {
      code: "llm_failed",
      message: "Model failed",
    },
    createdAt: "not-a-date",
    updatedAt: "2026-01-01T00:02:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    failedAt: "2026-01-01T00:01:00.000Z",
  });
});

test("toJobSnapshot handles wardrobe jobs without entity ids or errors", () => {
  const snapshot = toJobSnapshot({
    id: "job-2",
    providerJobId: null,
    profileEmail: "person@example.com",
    kind: "personalItemsReportGenerate",
    entityType: "wardrobe",
    entityId: null,
    dedupeKey: null,
    status: "queued",
    phase: null,
    progressCurrent: 0,
    progressTotal: null,
    progressLabel: null,
    payload: {},
    result: { reportId: "report-1" },
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: null,
    updatedAt: null,
    expiresAt: null,
  } as unknown as JobRunRecord);

  expect(snapshot.entity).toEqual({ type: "wardrobe", id: null });
  expect(snapshot.error).toBeNull();
  expect(snapshot.createdAt).toBe("1970-01-01T00:00:00.000Z");
});
