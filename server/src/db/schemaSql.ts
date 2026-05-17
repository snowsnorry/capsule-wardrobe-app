import type { SqlClientLike } from "./core.js";
import { executeSqlFile } from "./sqlFiles.js";

async function executeSchemaSqlFile(
  sql: SqlClientLike,
  fileName: string,
): Promise<void> {
  await executeSqlFile(
    sql,
    new URL(`./sql/schema/${fileName}`, import.meta.url),
  );
}

export async function executeSchemaSqlFiles(
  sql: SqlClientLike,
  fileNames: readonly string[],
): Promise<void> {
  for (const fileName of fileNames) {
    await executeSchemaSqlFile(sql, fileName);
  }
}
