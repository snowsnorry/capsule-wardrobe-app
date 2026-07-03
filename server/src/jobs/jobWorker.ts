import { logError, logInfo } from "../logger.js";
import { JOB_RUN_TIMEOUT_MS } from "../appConfig.js";
import type { QueueBackend } from "./queueBackend.js";
import {
  completeJobRun,
  failJobRun,
  startJobRun,
  writeJobProgress,
} from "./jobStore.js";
import { runJobHandler } from "./jobHandlers.js";

type JobWorker = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

type RunJobHandlerWithDeadlineInput = {
  backendSignal?: AbortSignal;
  deps: Record<string, unknown>;
  job: Awaited<ReturnType<typeof startJobRun>>;
  jobRunTimeoutMs: number;
};

function getWorkerJobId(data: Record<string, unknown>): string {
  return String(data?.jobId || "").trim();
}

function getErrorCode(error: unknown): string {
  return (
    String((error as { code?: unknown } | null)?.code || "").trim() ||
    "service_unavailable"
  );
}

function createCodedError(code: string) {
  const error = new Error(code) as Error & { code?: string };
  error.code = code;
  return error;
}

async function runJobHandlerWithDeadline({
  backendSignal,
  deps,
  job,
  jobRunTimeoutMs,
}: RunJobHandlerWithDeadlineInput) {
  if (!job) {
    return null;
  }

  const controller = new AbortController();
  if (backendSignal?.aborted) {
    controller.abort();
    throw createCodedError("job_aborted");
  }

  let timeout: NodeJS.Timeout | null = null;
  let abortReject: ((error: Error) => void) | null = null;
  const onBackendAbort = () => {
    controller.abort();
    abortReject?.(createCodedError("job_aborted"));
  };

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(createCodedError("job_deadline_exceeded"));
    }, jobRunTimeoutMs);
    timeout.unref?.();
  });
  const abortPromise = new Promise<never>((_resolve, reject) => {
    abortReject = reject;
    backendSignal?.addEventListener?.("abort", onBackendAbort, { once: true });
  });
  const handlerPromise = runJobHandler(deps, {
    job,
    signal: controller.signal,
    updateProgress: (update) =>
      writeJobProgress({ id: job.id, ...update }).then(() => {}),
  });
  handlerPromise.catch(() => undefined);

  try {
    return await Promise.race([handlerPromise, timeoutPromise, abortPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    backendSignal?.removeEventListener?.("abort", onBackendAbort);
  }
}

export function createJobWorker({
  backend,
  deps,
  enabled,
  jobRunTimeoutMs = JOB_RUN_TIMEOUT_MS,
  reconcilePendingProviderJobs,
}: {
  backend: QueueBackend;
  deps: Record<string, unknown>;
  enabled: boolean;
  jobRunTimeoutMs?: number;
  reconcilePendingProviderJobs?: () => Promise<unknown>;
}): JobWorker {
  return {
    async start() {
      if (!enabled) {
        logInfo("[jobs][worker] disabled");
        return;
      }

      await reconcilePendingProviderJobs?.();

      await backend.start(async ({ data, signal }) => {
        const jobId = getWorkerJobId(data);
        if (!jobId) {
          return;
        }
        const job = await startJobRun(jobId);
        if (!job) {
          return;
        }

        try {
          const result = await runJobHandlerWithDeadline({
            backendSignal: signal,
            deps,
            job,
            jobRunTimeoutMs,
          });
          await completeJobRun({ id: job.id, result });
        } catch (error) {
          await failJobRun({
            id: job.id,
            errorCode: getErrorCode(error),
            errorMessage: String((error as Error | null)?.message || error),
          });
          logError("[jobs][worker]", { jobId: job.id }, error);
          throw error;
        }
      });
      logInfo("[jobs][worker] started");
    },
    stop() {
      return backend.stop();
    },
  };
}
