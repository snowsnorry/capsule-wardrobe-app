import { beforeEach, expect, test, vi } from "vitest";

const storeApi = vi.hoisted(() => ({
  completeJobRun: vi.fn(),
  failJobRun: vi.fn(),
  startJobRun: vi.fn(),
  writeJobProgress: vi.fn(),
}));

const handlerApi = vi.hoisted(() => ({
  runJobHandler: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));
vi.mock("./jobStore.js", () => storeApi);
vi.mock("./jobHandlers.js", () => handlerApi);

import { createJobWorker } from "./jobWorker.js";
import type { JobRunRecord } from "./types.js";

const job = {
  id: "job-1",
  kind: "personalItemsReportGenerate",
  profileEmail: "person@example.com",
  status: "running",
  payload: {},
} as JobRunRecord;

beforeEach(() => {
  storeApi.completeJobRun.mockReset();
  storeApi.failJobRun.mockReset();
  storeApi.startJobRun.mockReset();
  storeApi.writeJobProgress.mockReset();
  handlerApi.runJobHandler.mockReset();
});

test("job worker skips backend registration when disabled", async () => {
  const backend = {
    enqueue: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  await createJobWorker({ backend, deps: {}, enabled: false }).start();

  expect(backend.start).not.toHaveBeenCalled();
});

test("job worker starts queued jobs, reports progress, and completes successful handlers", async () => {
  let workerHandler:
    | ((job: { data: Record<string, unknown> }) => Promise<void>)
    | null = null;
  const backend = {
    enqueue: vi.fn(),
    start: vi.fn(async (handler) => {
      workerHandler = handler;
    }),
    stop: vi.fn(),
  };
  storeApi.startJobRun.mockResolvedValue(job);
  storeApi.writeJobProgress.mockResolvedValue(job);
  handlerApi.runJobHandler.mockImplementation(async (_deps, context) => {
    await context.updateProgress({ phase: "running", current: 1 });
    return { ok: true };
  });

  await createJobWorker({
    backend,
    deps: { marker: true },
    enabled: true,
  }).start();
  await workerHandler?.({ data: { jobId: "job-1" } });

  expect(storeApi.startJobRun).toHaveBeenCalledWith("job-1");
  expect(handlerApi.runJobHandler).toHaveBeenCalledWith(
    { marker: true },
    expect.objectContaining({ job }),
  );
  expect(storeApi.writeJobProgress).toHaveBeenCalledWith({
    id: "job-1",
    phase: "running",
    current: 1,
  });
  expect(storeApi.completeJobRun).toHaveBeenCalledWith({
    id: "job-1",
    result: { ok: true },
  });
});

test("job worker records coded handler failures for transitioned jobs", async () => {
  let workerHandler:
    | ((job: { data: Record<string, unknown> }) => Promise<void>)
    | null = null;
  const backend = {
    enqueue: vi.fn(),
    start: vi.fn(async (handler) => {
      workerHandler = handler;
    }),
    stop: vi.fn(),
  };
  const error = new Error("llm_failed") as Error & { code?: string };
  error.code = "llm_failed";
  storeApi.startJobRun.mockResolvedValue(job);
  handlerApi.runJobHandler.mockRejectedValue(error);

  await createJobWorker({ backend, deps: {}, enabled: true }).start();

  await expect(workerHandler?.({ data: { jobId: "job-1" } })).rejects.toThrow(
    "llm_failed",
  );
  expect(storeApi.failJobRun).toHaveBeenCalledWith({
    id: "job-1",
    errorCode: "llm_failed",
    errorMessage: "llm_failed",
  });
});

test("job worker ignores provider messages without resolvable job ids or rows", async () => {
  let workerHandler:
    | ((job: { data: Record<string, unknown> }) => Promise<void>)
    | null = null;
  const backend = {
    enqueue: vi.fn(),
    start: vi.fn(async (handler) => {
      workerHandler = handler;
    }),
    stop: vi.fn(),
  };
  storeApi.startJobRun.mockResolvedValue(null);

  const worker = createJobWorker({ backend, deps: {}, enabled: true });
  await worker.start();
  await workerHandler?.({ data: {} });
  await workerHandler?.({ data: { jobId: "missing" } });
  await worker.stop();

  expect(handlerApi.runJobHandler).not.toHaveBeenCalled();
  expect(backend.stop).toHaveBeenCalledTimes(1);
});
