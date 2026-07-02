import { PgBoss } from "pg-boss";
import { JOB_WORKER_CONCURRENCY } from "../appConfig.js";
import { logError } from "../logger.js";
import type {
  QueueBackend,
  QueueBackendWorkerHandler,
} from "./queueBackend.js";

const CORE_QUEUE_NAME = "core-long-running";

type PgBossJobLike = {
  id: string;
  name: string;
  data?: Record<string, unknown> | null;
  signal?: AbortSignal;
};

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is not set");
    (error as Error & { code?: string }).code = "missing_database_url";
    throw error;
  }
  return databaseUrl;
}

function createBoss() {
  return new PgBoss({
    connectionString: getDatabaseUrl(),
  });
}

function attachBossErrorHandler(boss: PgBoss): PgBoss {
  boss.on("error", (error) => {
    logError("[jobs][pg-boss]", error);
  });
  return boss;
}

export function createPgBossQueueBackend({
  boss,
  queueName = CORE_QUEUE_NAME,
  workerConcurrency = JOB_WORKER_CONCURRENCY,
}: {
  boss?: PgBoss;
  queueName?: string;
  workerConcurrency?: number;
} = {}): QueueBackend {
  let bossInstance: PgBoss | null = boss || null;
  let bossErrorHandlerAttached = false;
  let started = false;
  let queueReady = false;
  let startupPromise: Promise<void> | null = null;
  const getBoss = () => {
    if (!bossInstance) {
      bossInstance = createBoss();
    }
    if (!bossErrorHandlerAttached) {
      attachBossErrorHandler(bossInstance);
      bossErrorHandlerAttached = true;
    }
    return bossInstance;
  };

  async function ensureStartedAndQueueReady() {
    if (started && queueReady) {
      return;
    }

    if (!startupPromise) {
      startupPromise = (async () => {
        const activeBoss = getBoss();
        if (!started) {
          await activeBoss.start();
          started = true;
        }
        if (!queueReady) {
          await activeBoss.createQueue(queueName);
          queueReady = true;
        }
      })();
    }

    try {
      await startupPromise;
    } finally {
      startupPromise = null;
    }
  }

  return {
    async enqueue({ jobId, kind, payload = {} }) {
      await ensureStartedAndQueueReady();
      const providerJobId = await getBoss().send(
        queueName,
        { jobId, kind, payload },
        { retryLimit: 1, retryBackoff: true },
      );
      return String(providerJobId || "");
    },

    async start(handler: QueueBackendWorkerHandler) {
      await ensureStartedAndQueueReady();

      await getBoss().work(
        queueName,
        {
          batchSize: 1,
          localConcurrency: Math.max(1, workerConcurrency),
          pollingIntervalSeconds: 2,
        },
        async ([job]: PgBossJobLike[]) => {
          const data = job?.data || {};
          await handler({
            id: String(job?.id || ""),
            name: String(job?.name || queueName),
            data,
            signal: job?.signal,
          });
        },
      );
    },

    async stop() {
      if (!started) {
        return;
      }
      await getBoss().stop({ graceful: true, timeout: 30_000 });
      started = false;
    },
  };
}
