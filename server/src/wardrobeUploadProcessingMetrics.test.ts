import { afterEach, expect, test } from "vitest";
import {
  getWardrobeUploadProcessingMetrics,
  incrementWardrobeUploadMetric,
  resetWardrobeUploadProcessingMetrics,
  setWardrobeUploadMetric,
} from "./wardrobeUploadProcessingMetrics.js";

afterEach(() => {
  resetWardrobeUploadProcessingMetrics();
});

test("wardrobe upload processing metrics can be incremented, set, read, and reset", () => {
  incrementWardrobeUploadMetric("uploadWorkerStartedCount");
  incrementWardrobeUploadMetric("uploadWorkerStartedCount", 2);
  incrementWardrobeUploadMetric("urlDownloadByteCapRejectedCount");
  setWardrobeUploadMetric("r2ClientCacheSize", 4);

  expect(getWardrobeUploadProcessingMetrics()).toEqual({
    r2ClientCacheSize: 4,
    uploadAbortCount: 0,
    uploadWorkerCompletedCount: 0,
    uploadWorkerKilledCount: 0,
    uploadWorkerStartedCount: 3,
    uploadWorkerTimeoutCount: 0,
    urlDownloadByteCapRejectedCount: 1,
  });

  resetWardrobeUploadProcessingMetrics();

  expect(getWardrobeUploadProcessingMetrics()).toEqual({
    r2ClientCacheSize: 0,
    uploadAbortCount: 0,
    uploadWorkerCompletedCount: 0,
    uploadWorkerKilledCount: 0,
    uploadWorkerStartedCount: 0,
    uploadWorkerTimeoutCount: 0,
    urlDownloadByteCapRejectedCount: 0,
  });
});
