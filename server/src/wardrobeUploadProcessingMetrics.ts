type WardrobeUploadProcessingMetrics = {
  r2ClientCacheSize: number;
  uploadAbortCount: number;
  uploadWorkerCompletedCount: number;
  uploadWorkerKilledCount: number;
  uploadWorkerStartedCount: number;
  uploadWorkerTimeoutCount: number;
  urlDownloadByteCapRejectedCount: number;
};

const metrics: WardrobeUploadProcessingMetrics = {
  r2ClientCacheSize: 0,
  uploadAbortCount: 0,
  uploadWorkerCompletedCount: 0,
  uploadWorkerKilledCount: 0,
  uploadWorkerStartedCount: 0,
  uploadWorkerTimeoutCount: 0,
  urlDownloadByteCapRejectedCount: 0,
};

function incrementWardrobeUploadMetric(
  key: keyof Omit<WardrobeUploadProcessingMetrics, "r2ClientCacheSize">,
  amount = 1,
) {
  metrics[key] += amount;
}

function setWardrobeUploadMetric(
  key: keyof WardrobeUploadProcessingMetrics,
  value: number,
) {
  metrics[key] = value;
}

function getWardrobeUploadProcessingMetrics() {
  return { ...metrics };
}

function resetWardrobeUploadProcessingMetrics() {
  Object.keys(metrics).forEach((key) => {
    metrics[key as keyof WardrobeUploadProcessingMetrics] = 0;
  });
}

export {
  getWardrobeUploadProcessingMetrics,
  incrementWardrobeUploadMetric,
  resetWardrobeUploadProcessingMetrics,
  setWardrobeUploadMetric,
};
export type { WardrobeUploadProcessingMetrics };
