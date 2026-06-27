import { afterEach, expect, test, vi } from "vitest";
import { createPgBossQueueBackend } from "./pgBossQueueBackend.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function createBossMock() {
  return {
    send: vi.fn(async () => "provider-1"),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    work: vi.fn(async () => undefined),
  };
}

function getMockCall(mock: { mock: { calls: unknown[][] } }, index = 0) {
  return mock.mock.calls[index];
}

test("pg-boss backend starts lazily and enqueues app-owned job payloads", async () => {
  const boss = createBossMock();
  const backend = createPgBossQueueBackend({
    boss: boss as never,
    queueName: "core",
  });

  await expect(
    backend.enqueue({
      jobId: "job-1",
      kind: "capsuleGenerate",
      payload: { capsuleId: "capsule-1" },
    }),
  ).resolves.toBe("provider-1");

  expect(boss.start).toHaveBeenCalledTimes(1);
  expect(boss.send).toHaveBeenCalledWith(
    "core",
    {
      jobId: "job-1",
      kind: "capsuleGenerate",
      payload: { capsuleId: "capsule-1" },
    },
    { retryLimit: 1, retryBackoff: true },
  );
});

test("pg-boss backend registers worker with configured local concurrency and normalized job data", async () => {
  const boss = createBossMock();
  const handler = vi.fn(async () => undefined);
  const backend = createPgBossQueueBackend({
    boss: boss as never,
    queueName: "core",
    workerConcurrency: 3,
  });

  await backend.start(handler);
  const worker = getMockCall(boss.work)[2] as (
    jobs: Array<{
      id: string;
      name?: string;
      data?: Record<string, unknown> | null;
      signal?: AbortSignal;
    }>,
  ) => Promise<void>;
  await worker([
    {
      id: "provider-1",
      data: { jobId: "job-1" },
    },
  ]);

  expect(boss.work).toHaveBeenCalledWith(
    "core",
    {
      batchSize: 1,
      localConcurrency: 3,
      pollingIntervalSeconds: 2,
    },
    expect.any(Function),
  );
  expect(handler).toHaveBeenCalledWith({
    id: "provider-1",
    name: "core",
    data: { jobId: "job-1" },
    signal: undefined,
  });
});

test("pg-boss backend clamps invalid concurrency and stops only after start", async () => {
  const boss = createBossMock();
  const backend = createPgBossQueueBackend({
    boss: boss as never,
    workerConcurrency: 0,
  });

  await backend.stop();
  expect(boss.stop).not.toHaveBeenCalled();

  await backend.start(async () => undefined);
  expect(getMockCall(boss.work)[1]).toMatchObject({ localConcurrency: 1 });

  await backend.stop();
  expect(boss.stop).toHaveBeenCalledWith({
    graceful: true,
    timeout: 30_000,
  });
});

test("pg-boss backend reports missing DATABASE_URL before creating a default boss", async () => {
  vi.stubEnv("DATABASE_URL", "");
  const backend = createPgBossQueueBackend();

  await expect(
    backend.enqueue({
      jobId: "job-1",
      kind: "capsuleGenerate",
      payload: {},
    }),
  ).rejects.toMatchObject({ code: "missing_database_url" });
});
