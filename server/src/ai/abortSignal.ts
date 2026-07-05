export function throwIfAborted(signal?: AbortSignal | null) {
  if (!signal?.aborted) {
    return;
  }
  const error = new Error("job_aborted") as Error & { code?: string };
  error.code = "job_aborted";
  throw error;
}
