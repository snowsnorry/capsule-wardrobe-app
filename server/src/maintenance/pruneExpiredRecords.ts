import "dotenv/config";
import { pruneExpiredRecords } from "../db/expiredRecords.js";
import { logError, logInfo } from "../logger.js";

async function main() {
  const result = await pruneExpiredRecords();
  logInfo("maintenance.prune.expired.records.completed", result);
}

void main().catch((error) => {
  logError("maintenance.prune.expired.records.failed", error);
  process.exitCode = 1;
});
