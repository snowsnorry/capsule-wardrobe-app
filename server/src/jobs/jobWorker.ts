import { logError, logInfo } from "../logger.js";
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

function getWorkerJobId(data: Record<string, unknown>): string {
  return String(data?.jobId || "").trim();
}

function getErrorCode(error: unknown): string {
  return (
    String((error as { code?: unknown } | null)?.code || "").trim() ||
    "service_unavailable"
  );
}

export function createJobWorker({
  backend,
  deps,
  enabled,
}: {
  backend: QueueBackend;
  deps: Record<string, unknown>;
  enabled: boolean;
}): JobWorker {
  return {
    async start() {
      if (!enabled) {
        logInfo("[jobs][worker] disabled");
        return;
      }

      await backend.start(async ({ data }) => {
        const jobId = getWorkerJobId(data);
        if (!jobId) {
          return;
        }
        const job = await startJobRun(jobId);
        if (!job) {
          return;
        }

        try {
          const result = await runJobHandler(deps, {
            job,
            updateProgress: (update) =>
              writeJobProgress({ id: job.id, ...update }).then(() => {}),
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
