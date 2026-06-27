import { expect, test } from "vitest";
import { createInMemoryJobService } from "./inMemoryJobService.js";

test("in-memory job service dedupes active jobs and allows new jobs after completion state", async () => {
  const service = createInMemoryJobService();
  const first = await service.enqueueJobImpl({
    kind: "capsuleGenerate",
    profileEmail: "PERSON@example.com",
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule:1",
    phase: "queued",
    progressTotal: 4,
    progressLabel: "Generating",
    payload: { capsuleId: "capsule-1" },
  });
  const second = await service.enqueueJobImpl({
    kind: "capsuleGenerate",
    profileEmail: "PERSON@example.com",
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule:1",
    phase: "queued",
    payload: { capsuleId: "capsule-1" },
  });

  expect(second).toBe(first);
  expect(first).toMatchObject({
    kind: "capsuleGenerate",
    status: "queued",
    progress: { current: 0, total: 4, label: "Generating" },
    entity: { type: "capsule", id: "capsule-1" },
  });

  const active = await service.listJobSnapshotsImpl({
    email: "person@example.com",
    status: "active",
  });
  expect(active.map((job) => job.id)).toEqual([first.id]);

  const stored = await service.getJobSnapshotImpl({
    id: first.id,
    email: "person@example.com",
  });
  expect(stored).toBe(first);
});

test("in-memory job service isolates jobs by normalized owner email", async () => {
  const service = createInMemoryJobService();
  const first = await service.enqueueJobImpl({
    kind: "capsuleReportGenerate",
    profileEmail: "PERSON@example.com",
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule-report:1",
    payload: { capsuleId: "capsule-1" },
  });
  const deduped = await service.enqueueJobImpl({
    kind: "capsuleReportGenerate",
    profileEmail: " person@EXAMPLE.com ",
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule-report:1",
    payload: { capsuleId: "capsule-1" },
  });
  const other = await service.enqueueJobImpl({
    kind: "capsuleReportGenerate",
    profileEmail: "other@example.com",
    entity: { type: "capsule", id: "capsule-1" },
    dedupeKey: "capsule-report:1",
    payload: { capsuleId: "capsule-1" },
  });

  expect(deduped).toBe(first);
  expect(other.id).not.toBe(first.id);
  await expect(
    service.getJobSnapshotImpl({
      id: first.id,
      email: "other@example.com",
    }),
  ).resolves.toBeNull();
  await expect(
    service.listJobSnapshotsImpl({
      email: "other@example.com",
      status: "active",
    }),
  ).resolves.toEqual([other]);
  await expect(
    service.clearJobRunsForEmailImpl("PERSON@example.com"),
  ).resolves.toBe(1);
  await expect(
    service.getJobSnapshotImpl({
      id: first.id,
      email: "person@example.com",
    }),
  ).resolves.toBeNull();
});

test("in-memory job service filters by concrete status and exposes worker no-ops", async () => {
  const service = createInMemoryJobService();
  await service.enqueueJobImpl({
    kind: "personalItemsReportGenerate",
    profileEmail: "person@example.com",
    entity: { type: "wardrobe", id: null },
    payload: {},
  });

  await expect(
    service.listJobSnapshotsImpl({
      email: "person@example.com",
      status: "completed",
    }),
  ).resolves.toEqual([]);
  await expect(
    service.clearJobRunsForEmailImpl("other@example.com"),
  ).resolves.toBe(0);
  await expect(service.listJobEventsAfterImpl()).resolves.toEqual([]);
  await expect(service.startJobWorkersImpl()).resolves.toBeUndefined();
  await expect(service.stopJobWorkersImpl()).resolves.toBeUndefined();
});
