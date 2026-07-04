import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./jobs/jobQueue.js");
  vi.doUnmock("./jobs/jobWorker.js");
  vi.unstubAllEnvs();
});

test("createAppDependencies rejects unsupported production job queue backends", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("E2E_SERVER", "false");
  vi.stubEnv("JOB_QUEUE_BACKEND", "bullmq");

  const { createAppDependencies } = await import("./appDependencies.js");

  expect(() => createAppDependencies()).toThrow(
    "unsupported_job_queue_backend:bullmq",
  );
});

test("createAppDependencies wires production pg-boss job dependencies", async () => {
  const enqueue = vi.fn();
  const reconcilePendingProviderJobs = vi.fn();
  const start = vi.fn();
  const stop = vi.fn();
  const createJobWorker = vi.fn(() => ({ start, stop }));
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("E2E_SERVER", "false");
  vi.stubEnv("JOB_QUEUE_BACKEND", "pg_boss");
  vi.stubEnv("JOB_WORKER_ENABLED", "true");
  vi.doMock("./jobs/jobQueue.js", () => ({
    createJobQueue: () => ({
      backend: "pg-boss-backend",
      enqueue,
      reconcilePendingProviderJobs,
    }),
  }));
  vi.doMock("./jobs/jobWorker.js", () => ({
    createJobWorker,
  }));

  const { createAppDependencies } = await import("./appDependencies.js");

  const deps = createAppDependencies({
    googleAuthClient: null,
    googleClientId: null,
  });

  expect(deps.enqueueJobImpl).toBe(enqueue);
  expect(deps.startJobWorkersImpl).toBe(start);
  expect(deps.stopJobWorkersImpl).toBe(stop);
  expect(createJobWorker).toHaveBeenCalledWith(
    expect.objectContaining({
      backend: "pg-boss-backend",
      deps: expect.objectContaining({ googleClientId: null }),
      enabled: true,
      reconcilePendingProviderJobs,
    }),
  );
});
