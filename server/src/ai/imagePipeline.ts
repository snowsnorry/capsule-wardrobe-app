function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const IMAGE_DOWNLOAD_CONCURRENCY = parsePositiveInteger(
  process.env.IMAGE_DOWNLOAD_CONCURRENCY,
  2,
);
const IMAGE_WORK_MAX_CONCURRENCY = parsePositiveInteger(
  process.env.IMAGE_WORK_MAX_CONCURRENCY,
  1,
);

let activeImageWork = 0;
const imageWorkQueue: Array<() => void> = [];

function acquireImageWorkSlot() {
  if (activeImageWork < IMAGE_WORK_MAX_CONCURRENCY) {
    activeImageWork += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    imageWorkQueue.push(resolve);
  });
}

function releaseImageWorkSlot() {
  const next = imageWorkQueue.shift();
  if (next) {
    next();
    return;
  }

  activeImageWork = Math.max(0, activeImageWork - 1);
}

async function runWithImageWorkSlot<T>(
  _label: string,
  work: () => Promise<T> | T,
): Promise<T> {
  await acquireImageWorkSlot();

  try {
    return await work();
  } finally {
    releaseImageWorkSlot();
  }
}

function getProcessMemoryUsage() {
  const usage = process.memoryUsage();

  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function sumCategoryBytes(categories: Array<{ buffer?: Buffer | null }> = []) {
  return categories.reduce(
    (total, entry) =>
      total + (Buffer.isBuffer(entry?.buffer) ? entry.buffer.length : 0),
    0,
  );
}

function sumImageAssetBytesById(
  imageAssetsById: Record<string, { buffer?: Buffer | null }> = {},
) {
  return Object.values(imageAssetsById).reduce(
    (total, asset) =>
      total + (Buffer.isBuffer(asset?.buffer) ? asset.buffer.length : 0),
    0,
  );
}

export {
  IMAGE_DOWNLOAD_CONCURRENCY,
  getProcessMemoryUsage,
  runWithImageWorkSlot,
  sumCategoryBytes,
  sumImageAssetBytesById,
};
