import { guardedServerFetchBuffer } from "./guardedServerFetch.js";
import { WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES } from "./wardrobeUploadImagesCore.js";

export const SERVER_IMAGE_DOWNLOAD_MAX_BYTES =
  WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES;
export const SERVER_IMAGE_DOWNLOAD_TOO_LARGE_ERROR = "image_download_too_large";

export type ServerImageDownloadResult = Awaited<
  ReturnType<typeof guardedServerFetchBuffer>
>;
export type ServerImageDownloadBufferImpl = typeof guardedServerFetchBuffer;

export async function downloadServerImageBuffer({
  errorCode = SERVER_IMAGE_DOWNLOAD_TOO_LARGE_ERROR,
  fetchBufferImpl = guardedServerFetchBuffer,
  timeoutMs,
  url,
}: {
  errorCode?: string;
  fetchBufferImpl?: ServerImageDownloadBufferImpl;
  timeoutMs: number;
  url: string;
}): Promise<ServerImageDownloadResult> {
  return fetchBufferImpl({
    errorCode,
    maxBytes: SERVER_IMAGE_DOWNLOAD_MAX_BYTES,
    timeoutMs,
    url,
  });
}
