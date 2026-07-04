import { getSqlClient } from "./core.js";
import type { JobPayload } from "../jobs/types.js";
import {
  cleanupStagedUploadFiles,
  type StagedUploadFile,
} from "../jobs/stagedUploadStorage.js";
import { normalizeEmail, parseJsonObject } from "./jobRows.js";

export async function clearJobRunsForEmail(email: string): Promise<number> {
  const sql = getSqlClient();
  const result = await sql<{
    id: string;
    payload?: JobPayload | string | null;
  }>`
    delete from job_runs
    where profile_email = ${normalizeEmail(email)}
    returning id, payload
  `;
  if (!Array.isArray(result)) {
    return 0;
  }
  const stagedFiles = result.flatMap((row) => {
    const payload = parseJsonObject(row.payload);
    return Array.isArray(payload.stagedFiles)
      ? (payload.stagedFiles as StagedUploadFile[])
      : [];
  });
  await cleanupStagedUploadFiles(stagedFiles);
  return result.length;
}
