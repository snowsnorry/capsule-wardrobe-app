import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
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
