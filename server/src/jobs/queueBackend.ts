type QueueBackendJob = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  signal?: AbortSignal;
};

export type QueueBackendWorkerHandler = (job: QueueBackendJob) => Promise<void>;

export type QueueBackend = {
  enqueue: (input: {
    jobId: string;
    kind: string;
    payload?: Record<string, unknown>;
  }) => Promise<string>;
  start: (handler: QueueBackendWorkerHandler) => Promise<void>;
  stop: () => Promise<void>;
};
