import { afterEach, expect, test } from "vitest";
import {
  buildInternalMetricsSnapshot,
  getHttpRequestMetrics,
  recordHttpRequestMetric,
  resetHttpRequestMetrics,
} from "./observabilityMetrics.js";

afterEach(() => {
  resetHttpRequestMetrics();
});

test("request metrics are counted by method and status", () => {
  recordHttpRequestMetric({
    durationMs: 12.5,
    method: "get",
    statusCode: 200,
  });
  recordHttpRequestMetric({
    durationMs: 20,
    method: "POST",
    statusCode: 503,
  });

  expect(getHttpRequestMetrics()).toEqual({
    total: 2,
    byMethod: { GET: 1, POST: 1 },
    byStatusCode: { "200": 1, "503": 1 },
    durationMs: { total: 32.5, max: 20 },
  });
});

test("internal metrics snapshot combines release, request, upload, and job metrics", async () => {
  recordHttpRequestMetric({
    durationMs: 5,
    method: "GET",
    statusCode: 200,
  });

  await expect(
    buildInternalMetricsSnapshot({
      releaseMetadata: {
        service: "capsule-wardrobe-server",
        commit: "abc123",
      },
      getWardrobeUploadProcessingMetricsImpl: () => ({
        r2ClientCacheSize: 1,
        uploadAbortCount: 0,
        uploadWorkerCompletedCount: 2,
        uploadWorkerKilledCount: 0,
        uploadWorkerStartedCount: 2,
        uploadWorkerTimeoutCount: 0,
        urlDownloadByteCapRejectedCount: 0,
      }),
      getJobMetricsImpl: async () => ({
        total: 1,
        byStatus: { queued: 1, running: 0, completed: 0, failed: 0 },
        byKind: {},
        stuck: { total: 0, queued: 0, running: 0 },
      }),
    }),
  ).resolves.toMatchObject({
    release: {
      service: "capsule-wardrobe-server",
      commit: "abc123",
    },
    requests: {
      total: 1,
      byMethod: { GET: 1 },
    },
    uploads: {
      uploadWorkerCompletedCount: 2,
    },
    jobs: {
      total: 1,
    },
  });
});
