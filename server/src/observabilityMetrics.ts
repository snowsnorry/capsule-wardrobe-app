import { RELEASE_METADATA } from "./appConfig.js";
import { getWardrobeUploadProcessingMetrics } from "./wardrobeUploadProcessingMetrics.js";
import type { JobMetrics } from "./jobs/types.js";

type RequestMetrics = {
  total: number;
  byMethod: Record<string, number>;
  byStatusCode: Record<string, number>;
  durationMs: {
    total: number;
    max: number;
  };
};

type InternalMetricsSnapshot = {
  release: typeof RELEASE_METADATA;
  requests: RequestMetrics;
  uploads: ReturnType<typeof getWardrobeUploadProcessingMetrics>;
  jobs: JobMetrics | null;
};

const requestMetrics: RequestMetrics = {
  total: 0,
  byMethod: {},
  byStatusCode: {},
  durationMs: {
    total: 0,
    max: 0,
  },
};

function incrementCounter(map: Record<string, number>, key: string): void {
  map[key] = (map[key] || 0) + 1;
}

export function recordHttpRequestMetric({
  durationMs,
  method,
  statusCode,
}: {
  durationMs: number;
  method: string;
  statusCode: number;
}): void {
  requestMetrics.total += 1;
  incrementCounter(requestMetrics.byMethod, method.toUpperCase());
  incrementCounter(requestMetrics.byStatusCode, String(statusCode));
  requestMetrics.durationMs.total += durationMs;
  requestMetrics.durationMs.max = Math.max(
    requestMetrics.durationMs.max,
    durationMs,
  );
}

export function getHttpRequestMetrics(): RequestMetrics {
  return {
    total: requestMetrics.total,
    byMethod: { ...requestMetrics.byMethod },
    byStatusCode: { ...requestMetrics.byStatusCode },
    durationMs: { ...requestMetrics.durationMs },
  };
}

export function resetHttpRequestMetrics(): void {
  requestMetrics.total = 0;
  requestMetrics.byMethod = {};
  requestMetrics.byStatusCode = {};
  requestMetrics.durationMs = { total: 0, max: 0 };
}

export async function buildInternalMetricsSnapshot({
  getJobMetricsImpl,
  getWardrobeUploadProcessingMetricsImpl = getWardrobeUploadProcessingMetrics,
  releaseMetadata = RELEASE_METADATA,
}: {
  getJobMetricsImpl?: (() => Promise<JobMetrics>) | null;
  getWardrobeUploadProcessingMetricsImpl?: typeof getWardrobeUploadProcessingMetrics;
  releaseMetadata?: typeof RELEASE_METADATA;
} = {}): Promise<InternalMetricsSnapshot> {
  return {
    release: releaseMetadata,
    requests: getHttpRequestMetrics(),
    uploads: getWardrobeUploadProcessingMetricsImpl(),
    jobs: getJobMetricsImpl ? await getJobMetricsImpl() : null,
  };
}
