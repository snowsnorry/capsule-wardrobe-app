import {
  getFirstRow,
  getSqlClient,
  type DatabaseConnectionRow,
} from "./core.js";
import { ensureSearchTable } from "./searchSchema.js";
import { executeSchemaSqlFiles } from "./schemaSql.js";

export { ensureSearchTable } from "./searchSchema.js";

const AUTH_SCHEMA_FILES = [
  "010_create_login_codes_table.sql",
  "011_create_user_sessions_table.sql",
] as const;

const PROFILE_SCHEMA_FILES = ["020_create_profiles_table.sql"] as const;

const LIKED_ITEMS_SCHEMA_FILES = [
  "090_create_user_liked_items_table.sql",
] as const;

const PASSKEY_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "030_create_profile_passkeys_table.sql",
  "031_create_profile_passkeys_profile_email_index.sql",
  "032_create_passkey_challenges_table.sql",
  "033_create_passkey_challenges_expires_at_index.sql",
] as const;

const CAPSULE_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "040_create_capsules_table.sql",
  "041_create_capsules_email_updated_at_index.sql",
  "042_create_capsules_email_lower_name_index.sql",
] as const;

const OUTFIT_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "043_create_outfits_table.sql",
  "044_create_outfits_email_updated_at_index.sql",
  "045_create_outfits_email_lower_name_index.sql",
] as const;

const SHARED_CAPSULE_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "050_create_shared_capsules_table.sql",
  "051_create_shared_capsules_profile_email_name_hash_index.sql",
  "052_create_shared_capsules_expires_at_index.sql",
] as const;

const WARDROBE_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "002_create_vector_extension.sql",
  "060_create_wardrobe_table.sql",
  "061_create_wardrobe_profile_email_updated_at_index.sql",
  "062_create_wardrobe_profile_email_from_catalog_url_index.sql",
  "063_create_personal_items_reports_table.sql",
] as const;

const MCP_OAUTH_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "080_create_mcp_oauth_authorization_codes_table.sql",
  "081_create_mcp_oauth_authorization_codes_expires_at_index.sql",
  "082_create_mcp_oauth_grants_table.sql",
  "083_create_mcp_oauth_grants_active_index.sql",
  "084_create_mcp_oauth_registered_clients_table.sql",
  "086_create_mcp_oauth_refresh_tokens_table.sql",
  "087_create_mcp_oauth_refresh_tokens_active_index.sql",
] as const;

const JOB_SCHEMA_FILES = [
  "001_create_pgcrypto_extension.sql",
  "100_create_job_runs_table.sql",
  "101_create_job_events_table.sql",
  "102_create_job_runs_profile_created_index.sql",
  "103_create_job_runs_profile_kind_status_index.sql",
  "104_create_job_runs_entity_status_index.sql",
  "105_create_job_runs_active_dedupe_index.sql",
  "106_create_job_events_job_id_index.sql",
  "107_create_job_runs_expires_at_index.sql",
] as const;

export async function checkDatabaseConnection(): Promise<DatabaseConnectionRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<DatabaseConnectionRow>`
    select
      current_database() as database,
      now() as now
  `,
  );
  return row;
}

export async function ensureAuthTables(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, AUTH_SCHEMA_FILES);
}

export async function ensureProfilesTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, PROFILE_SCHEMA_FILES);
}

export async function ensureLikedItemsTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, LIKED_ITEMS_SCHEMA_FILES);
}

export async function ensurePasskeysTables(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, PASSKEY_SCHEMA_FILES);
}

export async function ensureCapsulesTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, CAPSULE_SCHEMA_FILES);
}

async function ensureOutfitsTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, OUTFIT_SCHEMA_FILES);
}

export async function ensureSharedCapsulesTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, SHARED_CAPSULE_SCHEMA_FILES);
}

export async function ensureWardrobeTable(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, WARDROBE_SCHEMA_FILES);
}

export async function ensureMcpOAuthTables(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, MCP_OAUTH_SCHEMA_FILES);
}

export async function ensureJobTables(): Promise<void> {
  const sql = getSqlClient();
  await executeSchemaSqlFiles(sql, JOB_SCHEMA_FILES);
}

export async function ensureTables(): Promise<void> {
  await ensureAuthTables();
  await ensureProfilesTable();
  await ensureLikedItemsTable();
  await ensurePasskeysTables();
  await ensureCapsulesTable();
  await ensureOutfitsTable();
  await ensureSharedCapsulesTable();
  await ensureWardrobeTable();
  await ensureMcpOAuthTables();
  await ensureJobTables();
  await ensureSearchTable();
}
