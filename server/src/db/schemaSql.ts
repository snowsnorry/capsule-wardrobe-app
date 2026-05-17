import { readFile } from "node:fs/promises";
import type { SqlClientLike, SqlResultLike } from "./core.js";

type RawSqlClientLike = {
  <TRow = unknown>(
    query: string,
    values?: readonly unknown[],
  ): Promise<SqlResultLike<TRow>>;
};

const schemaSqlCache = new Map<string, string>();

async function readSchemaSqlFile(fileName: string): Promise<string> {
  const cachedSql = schemaSqlCache.get(fileName);
  if (cachedSql) {
    return cachedSql;
  }

  const sql = await readFile(
    new URL(`./sql/schema/${fileName}`, import.meta.url),
    "utf8",
  );
  schemaSqlCache.set(fileName, sql);
  return sql;
}

export async function executeSchemaSqlFile(
  sql: SqlClientLike,
  fileName: string,
): Promise<void> {
  await (sql as SqlClientLike & RawSqlClientLike)(
    await readSchemaSqlFile(fileName),
    [],
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
