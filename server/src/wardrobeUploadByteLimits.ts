import { incrementWardrobeUploadMetric } from "./wardrobeUploadProcessingMetrics.js";

type HeaderLike = {
  get?: (name: string) => unknown;
};

function getHeaderValue(headers: HeaderLike | null | undefined, name: string) {
  return String(headers?.get?.(name) || "").trim();
}

function getContentLength(headers: HeaderLike | null | undefined) {
  const value = getHeaderValue(headers, "content-length");
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function throwByteLimitError(errorCode: string): never {
  incrementWardrobeUploadMetric("urlDownloadByteCapRejectedCount");
  throw new Error(errorCode);
}

function assertContentLengthUnderLimit({
  errorCode,
  headers,
  maxBytes,
}: {
  errorCode: string;
  headers: HeaderLike | null | undefined;
  maxBytes: number;
}) {
  const contentLength = getContentLength(headers);
  if (contentLength !== null && contentLength > maxBytes) {
    throwByteLimitError(errorCode);
  }
}

function assertBufferUnderLimit(
  buffer: Buffer,
  maxBytes: number,
  errorCode: string,
) {
  if (buffer.length > maxBytes) {
    throwByteLimitError(errorCode);
  }
  return buffer;
}

function createByteLimitedCollector(maxBytes: number, errorCode: string) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  return {
    append(chunk: Buffer | Uint8Array) {
      const buffer = Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        throwByteLimitError(errorCode);
      }
      chunks.push(buffer);
    },
    getBuffer() {
      return Buffer.concat(chunks);
    },
    get hasChunks() {
      return chunks.length > 0;
    },
  };
}

export {
  assertBufferUnderLimit,
  assertContentLengthUnderLimit,
  createByteLimitedCollector,
};
export type { HeaderLike };
