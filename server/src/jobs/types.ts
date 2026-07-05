export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobKind =
  | "capsuleGenerate"
  | "capsuleRegenerateSelected"
  | "capsuleReportGenerate"
  | "outfitImageGenerate"
  | "outfitReportGenerate"
  | "outfitSetImageGenerate"
  | "personalItemsReportGenerate"
  | "personalItemUploadFiles"
  | "personalItemUploadUrls";

export type JobEntityType = "capsule" | "outfit" | "wardrobe";

type JobEntity = {
  type: JobEntityType;
  id: string | null;
};

type JobProgress = {
  current: number;
  total: number | null;
  label: string | null;
};

type JobError = {
  code: string;
  message: string | null;
};

export type JobSnapshot = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  phase: string | null;
  progress: JobProgress;
  entity: JobEntity | null;
  result: Record<string, unknown> | null;
  error: JobError | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

export type JobPayload = Record<string, unknown>;

export type EnqueueJobInput = {
  kind: JobKind;
  profileEmail: string;
  payload: JobPayload;
  entity?: JobEntity | null;
  dedupeKey?: string | null;
  phase?: string | null;
  progressTotal?: number | null;
  progressLabel?: string | null;
};

export type JobRunRecord = {
  id: string;
  providerJobId: string | null;
  profileEmail: string;
  kind: JobKind;
  entityType: JobEntityType | null;
  entityId: string | null;
  dedupeKey: string | null;
  status: JobStatus;
  phase: string | null;
  progressCurrent: number;
  progressTotal: number | null;
  progressLabel: string | null;
  payload: JobPayload;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type JobEventRecord = {
  id: number;
  jobId: string;
  eventType: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type JobHandlerContext = {
  job: JobRunRecord;
  signal?: AbortSignal;
  updateProgress: (update: {
    phase?: string | null;
    current?: number;
    total?: number | null;
    label?: string | null;
  }) => Promise<void>;
};

export type JobMetrics = {
  total: number;
  byStatus: Record<JobStatus, number>;
  byKind: Partial<Record<JobKind, Record<JobStatus, number>>>;
  stuck: {
    total: number;
    queued: number;
    running: number;
  };
};
