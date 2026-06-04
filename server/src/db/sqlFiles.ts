import { readFile } from "node:fs/promises";
import type { SqlResultLike } from "./core.js";

type TemplateSqlClientLike = {
  <TRow = unknown>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<SqlResultLike<TRow>>;
};

type RawSqlClientLike = {
  query<TRow = unknown>(
    query: string,
    values?: readonly unknown[],
  ): Promise<SqlResultLike<TRow>>;
};

const sqlFileCache = new Map<string, string>();

async function readSqlFile(fileUrl: URL): Promise<string> {
  const cacheKey = fileUrl.href;
  const cachedSql = sqlFileCache.get(cacheKey);
  if (cachedSql) {
    return cachedSql;
  }

  const sql = await readFile(fileUrl, "utf8");
  sqlFileCache.set(cacheKey, sql);
  return sql;
}

export async function executeSqlFile<TRow = unknown>(
  sql: TemplateSqlClientLike,
  fileUrl: URL,
  values: readonly unknown[] = [],
): Promise<SqlResultLike<TRow>> {
  const query = await readSqlFile(fileUrl);
  const rawSql = sql as TemplateSqlClientLike & Partial<RawSqlClientLike>;
  if (rawSql.query) {
    return rawSql.query<TRow>(query, values);
  }

  return (
    sql as TemplateSqlClientLike & {
      <TRow = unknown>(
        query: string,
        values?: readonly unknown[],
      ): Promise<SqlResultLike<TRow>>;
    }
  )<TRow>(query, values);
}
