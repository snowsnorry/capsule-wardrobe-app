import { getSqlClient } from "./core.js";
import { executeSchemaSqlFiles } from "./schemaSql.js";

const SEARCH_SCHEMA_FILES = [
  "070_create_search_table.sql",
  "071_add_search_exact_color.sql",
  "072_add_search_exact_color_range.sql",
] as const;

export async function ensureSearchTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, SEARCH_SCHEMA_FILES);
}
