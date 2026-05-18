import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getResultRows,
  getSqlClient,
  stableStringify,
  type SqlClientLike,
} from "../db/core.js";

type JsonObject = Record<string, unknown>;
type ColumnRow = { tableName: string; columnName: string };
type CapsuleRow = {
  id: string;
  draft: JsonObject | null;
  saved: JsonObject | null;
};
type SharedCapsuleRow = { id: string; content: JsonObject | null };
type MigrationStats = {
  capsulesUpdated: number;
  sharedCapsulesUpdated: number;
  itemKeysRenamed: number;
};

const SCHEMA_RENAMES = [
  ["login_codes", "codeHash", "code_hash"],
  ["login_codes", "expiresAt", "expires_at"],
  ["login_codes", "consumedAt", "consumed_at"],
  ["user_sessions", "sessionId", "session_id"],
  ["user_sessions", "csrfToken", "csrf_token"],
  ["user_sessions", "createdAt", "created_at"],
  ["user_sessions", "expiresAt", "expires_at"],
] as const;

const SCHEMA_RENAME_SQL: Record<
  string,
  (sql: SqlClientLike) => Promise<unknown>
> = {
  "login_codes.codeHash": (sql) =>
    sql`alter table public.login_codes rename column "codeHash" to code_hash`,
  "login_codes.expiresAt": (sql) =>
    sql`alter table public.login_codes rename column "expiresAt" to expires_at`,
  "login_codes.consumedAt": (sql) =>
    sql`alter table public.login_codes rename column "consumedAt" to consumed_at`,
  "user_sessions.sessionId": (sql) =>
    sql`alter table public.user_sessions rename column "sessionId" to session_id`,
  "user_sessions.csrfToken": (sql) =>
    sql`alter table public.user_sessions rename column "csrfToken" to csrf_token`,
  "user_sessions.createdAt": (sql) =>
    sql`alter table public.user_sessions rename column "createdAt" to created_at`,
  "user_sessions.expiresAt": (sql) =>
    sql`alter table public.user_sessions rename column "expiresAt" to expires_at`,
};

const JSON_KEY_RENAMES = [
  ["product_id", "productId"],
  ["image_url", "imageUrl"],
  ["formality_level", "formalityLevel"],
  ["color_base", "colorBase"],
  ["is_neutral", "isNeutral"],
  ["closure_type", "closureType"],
  ["raw_image_url", "rawImageUrl"],
  ["processing_status", "processingStatus"],
  ["wardrobe_id", "wardrobeId"],
] as const;

function assertObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function normalizeWardrobeItemKeys(value: unknown): {
  item: unknown;
  renamed: number;
} {
  const source = assertObject(value);
  if (!source) {
    return { item: value, renamed: 0 };
  }

  let renamed = 0;
  const next: JsonObject = { ...source };
  for (const [oldKey, newKey] of JSON_KEY_RENAMES) {
    if (!Object.prototype.hasOwnProperty.call(next, oldKey)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(next, newKey)) {
      next[newKey] = next[oldKey];
    }
    delete next[oldKey];
    renamed += 1;
  }

  return { item: next, renamed };
}

function normalizeSnapshotItemKeys(snapshot: JsonObject | null): {
  snapshot: JsonObject | null;
  renamed: number;
} {
  if (!snapshot) {
    return { snapshot, renamed: 0 };
  }

  const data = assertObject(snapshot.data);
  const wardrobe = assertObject(data?.wardrobe);
  if (!data || !wardrobe || !Array.isArray(wardrobe.items)) {
    return { snapshot, renamed: 0 };
  }

  let renamed = 0;
  const items = wardrobe.items.map((item) => {
    const normalized = normalizeWardrobeItemKeys(item);
    renamed += normalized.renamed;
    return normalized.item;
  });

  if (renamed === 0) {
    return { snapshot, renamed: 0 };
  }

  return {
    snapshot: {
      ...snapshot,
      data: {
        ...data,
        wardrobe: {
          ...wardrobe,
          items,
        },
      },
    },
    renamed,
  };
}

function buildColumnMap(rows: ColumnRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = map.get(row.tableName) ?? new Set<string>();
    columns.add(row.columnName);
    map.set(row.tableName, columns);
  }
  return map;
}

async function getAuthColumnMap(sql: SqlClientLike) {
  const rows = getResultRows(
    await sql<ColumnRow>`
      select table_name as "tableName", column_name as "columnName"
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('login_codes', 'user_sessions')
    `,
  );
  return buildColumnMap(rows);
}

function getSchemaActions(columnMap: Map<string, Set<string>>) {
  return SCHEMA_RENAMES.map(([tableName, oldName, newName]) => {
    const columns = columnMap.get(tableName) ?? new Set<string>();
    const hasOld = columns.has(oldName);
    const hasNew = columns.has(newName);
    if (hasOld && hasNew) {
      throw new Error(`ambiguous_schema_state:${tableName}.${oldName}`);
    }
    if (!hasOld && !hasNew) {
      throw new Error(`missing_schema_column:${tableName}.${oldName}`);
    }
    return { tableName, oldName, newName, needsRename: hasOld };
  });
}

async function renameAuthColumns(sql: SqlClientLike) {
  const actions = getSchemaActions(await getAuthColumnMap(sql)).filter(
    (action) => action.needsRename,
  );
  for (const action of actions) {
    await SCHEMA_RENAME_SQL[`${action.tableName}.${action.oldName}`]?.(sql);
  }
  return actions.length;
}

function hasChanged(before: unknown, after: unknown): boolean {
  return stableStringify(before) !== stableStringify(after);
}

async function migrateCapsuleSnapshots(sql: SqlClientLike) {
  let itemKeysRenamed = 0;
  let capsulesUpdated = 0;
  const rows = getResultRows(
    await sql<CapsuleRow>`
      select id::text as id, draft, saved
      from public.capsules
      where draft is not null or saved is not null
      order by id
    `,
  );

  for (const row of rows) {
    const draft = normalizeSnapshotItemKeys(row.draft);
    const saved = normalizeSnapshotItemKeys(row.saved);
    if (
      !hasChanged(row.draft, draft.snapshot) &&
      !hasChanged(row.saved, saved.snapshot)
    ) {
      continue;
    }
    await sql`
      update public.capsules
      set draft = ${JSON.stringify(draft.snapshot)}::jsonb,
          saved = ${JSON.stringify(saved.snapshot)}::jsonb
      where id = ${row.id}
    `;
    capsulesUpdated += 1;
    itemKeysRenamed += draft.renamed + saved.renamed;
  }

  return { capsulesUpdated, itemKeysRenamed };
}

async function migrateSharedCapsules(sql: SqlClientLike) {
  let itemKeysRenamed = 0;
  let sharedCapsulesUpdated = 0;
  const rows = getResultRows(
    await sql<SharedCapsuleRow>`
      select id::text as id, content
      from public.shared_capsules
      where content is not null
      order by id
    `,
  );

  for (const row of rows) {
    const content = normalizeSnapshotItemKeys(row.content);
    if (!hasChanged(row.content, content.snapshot)) {
      continue;
    }
    await sql`
      update public.shared_capsules
      set content = ${JSON.stringify(content.snapshot)}::jsonb
      where id = ${row.id}
    `;
    sharedCapsulesUpdated += 1;
    itemKeysRenamed += content.renamed;
  }

  return { sharedCapsulesUpdated, itemKeysRenamed };
}

async function countLegacyJsonKeys(sql: SqlClientLike): Promise<number> {
  let total = 0;
  const capsuleRows = getResultRows(
    await sql<CapsuleRow>`
      select id::text as id, draft, saved
      from public.capsules
      where draft is not null or saved is not null
    `,
  );
  for (const row of capsuleRows) {
    total += normalizeSnapshotItemKeys(row.draft).renamed;
    total += normalizeSnapshotItemKeys(row.saved).renamed;
  }

  const sharedRows = getResultRows(
    await sql<SharedCapsuleRow>`
      select id::text as id, content
      from public.shared_capsules
      where content is not null
    `,
  );
  for (const row of sharedRows) {
    total += normalizeSnapshotItemKeys(row.content).renamed;
  }
  return total;
}

async function assertPostMigration(sql: SqlClientLike) {
  const actions = getSchemaActions(await getAuthColumnMap(sql));
  const remainingSchemaRenames = actions.filter((action) => action.needsRename);
  if (remainingSchemaRenames.length > 0) {
    throw new Error(`schema_postcheck_failed:${remainingSchemaRenames.length}`);
  }

  if ((await countLegacyJsonKeys(sql)) > 0) {
    throw new Error("json_postcheck_failed");
  }
}

function redactDatabaseUrl(value: string | undefined): string {
  if (!value) {
    return "<missing DATABASE_URL>";
  }
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = "****";
    }
    return url.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

async function runNamingConventionMigration(
  sql: SqlClientLike = getSqlClient(),
): Promise<MigrationStats & { schemaColumnsRenamed: number }> {
  const schemaColumnsRenamed = await renameAuthColumns(sql);
  const capsuleStats = await migrateCapsuleSnapshots(sql);
  const sharedStats = await migrateSharedCapsules(sql);
  await assertPostMigration(sql);

  return {
    schemaColumnsRenamed,
    capsulesUpdated: capsuleStats.capsulesUpdated,
    sharedCapsulesUpdated: sharedStats.sharedCapsulesUpdated,
    itemKeysRenamed: capsuleStats.itemKeysRenamed + sharedStats.itemKeysRenamed,
  };
}

async function runCli() {
  process.stdout.write(
    `[migration:naming] target=${redactDatabaseUrl(process.env.DATABASE_URL)}`,
  );
  process.stdout.write("\n");
  const stats = await runNamingConventionMigration();
  process.stdout.write(
    `[migration:naming] complete ${JSON.stringify(stats)}\n`,
  );
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  runCli().catch((error) => {
    process.stderr.write(`[migration:naming] failed ${String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  normalizeSnapshotItemKeys,
  normalizeWardrobeItemKeys,
  redactDatabaseUrl,
  runNamingConventionMigration,
};
