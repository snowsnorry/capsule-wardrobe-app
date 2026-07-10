import { expect, test } from "vitest";
import { createInMemoryJobService } from "./inMemoryJobService.js";

test("in-memory job service exposes aggregate metrics", async () => {
  const service = createInMemoryJobService();

  const firstJob = await service.enqueueJobImpl({
    kind: "capsuleReportGenerate",
    profileEmail: "person@example.com",
    payload: { capsuleId: "capsule-1" },
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule-report:capsule-1",
  });
  const dedupedJob = await service.enqueueJobImpl({
    kind: "capsuleReportGenerate",
    profileEmail: " PERSON@example.com ",
    payload: { capsuleId: "capsule-1" },
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule-report:capsule-1",
  });
  const secondJob = await service.enqueueJobImpl({
    kind: "outfitReportGenerate",
    profileEmail: "person@example.com",
    payload: { outfitId: "outfit-1" },
    entity: { type: "outfit", id: "outfit-1" },
  });

  expect(dedupedJob).toBe(firstJob);
  await expect(
    service.getJobSnapshotImpl({
      id: firstJob.id,
      email: "PERSON@example.com",
    }),
  ).resolves.toBe(firstJob);
  await expect(
    service.getJobSnapshotImpl({ id: firstJob.id, email: "other@example.com" }),
  ).resolves.toBeNull();
  await expect(
    service.listJobSnapshotsImpl({
      email: "person@example.com",
      status: "active",
    }),
  ).resolves.toEqual([firstJob, secondJob]);
  await expect(
    service.listJobSnapshotsImpl({
      email: "person@example.com",
      status: "queued",
    }),
  ).resolves.toEqual([firstJob, secondJob]);
  await expect(
    service.listJobSnapshotsImpl({ email: "other@example.com" }),
  ).resolves.toEqual([]);
  await expect(service.getJobMetricsImpl()).resolves.toMatchObject({
    total: 2,
    byStatus: {
      queued: 2,
      running: 0,
      completed: 0,
      failed: 0,
    },
    byKind: {
      capsuleReportGenerate: {
        queued: 1,
        running: 0,
        completed: 0,
        failed: 0,
      },
      outfitReportGenerate: {
        queued: 1,
        running: 0,
        completed: 0,
        failed: 0,
      },
    },
    stuck: {
      total: 0,
      queued: 0,
      running: 0,
    },
  });
  firstJob.status = "running";
  firstJob.updatedAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  secondJob.updatedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  await expect(service.getJobMetricsImpl()).resolves.toMatchObject({
    total: 2,
    byStatus: {
      queued: 1,
      running: 1,
      completed: 0,
      failed: 0,
    },
    stuck: {
      total: 2,
      queued: 1,
      running: 1,
    },
  });
  await expect(
    service.listJobEventsAfterImpl({
      email: "person@example.com",
      afterId: 0,
    }),
  ).resolves.toHaveLength(2);
  await expect(service.startJobWorkersImpl()).resolves.toBeUndefined();
  await expect(service.stopJobWorkersImpl()).resolves.toBeUndefined();
  await expect(
    service.clearJobRunsForEmailImpl("other@example.com"),
  ).resolves.toBe(0);
  await expect(
    service.clearJobRunsForEmailImpl("PERSON@example.com"),
  ).resolves.toBe(2);
  await expect(service.getJobMetricsImpl()).resolves.toMatchObject({
    total: 0,
    byStatus: { queued: 0, running: 0, completed: 0, failed: 0 },
  });
});

test("in-memory job service enforces active caps after dedupe", async () => {
  const service = createInMemoryJobService();
  const firstReport = await service.enqueueJobImpl({
    kind: "personalItemsReportGenerate",
    profileEmail: "person@example.com",
    payload: {},
    entity: { type: "wardrobe", id: null },
    dedupeKey: "report:1",
  });

  await expect(
    service.enqueueJobImpl({
      kind: "personalItemsReportGenerate",
      profileEmail: "person@example.com",
      payload: {},
      entity: { type: "wardrobe", id: null },
      dedupeKey: "report:1",
    }),
  ).resolves.toBe(firstReport);

  await expect(
    service.enqueueJobImpl({
      kind: "personalItemsReportGenerate",
      profileEmail: "person@example.com",
      payload: {},
      entity: { type: "wardrobe", id: null },
      dedupeKey: "report:2",
    }),
  ).rejects.toMatchObject({ code: "too_many_active_jobs" });
});
