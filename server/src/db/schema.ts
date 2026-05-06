import {
  getFirstRow,
  getSqlClient,
  type DatabaseConnectionRow
} from "./core.js";

export async function checkDatabaseConnection(): Promise<DatabaseConnectionRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<DatabaseConnectionRow>`
    select
      current_database() as database,
      now() as now
  `);
  return row;
}

export async function ensureLoginCodesTable(): Promise<void> {
  const sql = getSqlClient();
  await sql`
    create table if not exists login_codes (
      email text primary key,
      "codeHash" text not null,
      nonce text not null default '',
      "expiresAt" timestamptz not null,
      attempts integer not null default 0,
      "consumedAt" timestamptz null
    )
  `;
}

export async function ensureSessionsTable(): Promise<void> {
  const sql = getSqlClient();
  await sql`
    create table if not exists user_sessions (
      "sessionId" text primary key,
      email text not null,
      "csrfToken" text not null default '',
      "createdAt" timestamptz not null,
      "expiresAt" timestamptz not null
    )
  `;
}

export async function ensurePasskeysTables(): Promise<void> {
  const sql = getSqlClient();
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists profile_passkeys (
      id uuid primary key default gen_random_uuid(),
      profile_email text not null references profiles(email) on delete cascade,
      credential_id text not null unique,
      credential_public_key text not null,
      counter bigint not null default 0,
      device_type text null,
      backed_up boolean null,
      transports text[] not null default '{}'::text[],
      name text null,
      aaguid text null,
      last_used_at timestamptz null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    alter table profile_passkeys
    add column if not exists aaguid text null
  `;
  await sql`
    create index if not exists profile_passkeys_profile_email_idx
    on profile_passkeys(profile_email)
  `;
  await sql`
    create table if not exists passkey_challenges (
      id text primary key,
      kind text not null,
      challenge text not null,
      profile_email text null,
      expires_at timestamptz not null,
      consumed_at timestamptz null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists passkey_challenges_expires_at_idx
    on passkey_challenges(expires_at)
  `;
}

export async function ensureProfilesTable(): Promise<void> {
  const sql = getSqlClient();
  await ensureProfilesBaseTable(sql);
  await ensureProfilesSettingColumns(sql);
  await ensureProfilesSettingsConstraints(sql);
}

async function ensureProfilesBaseTable(sql: ReturnType<typeof getSqlClient>): Promise<void> {
  await sql`
    create table if not exists profiles (
      email text primary key,
      active_capsule_id uuid null,
      locale text not null,
      fullname text null,
      theme text not null default 'system',
      llm text not null default 'openai:gpt-5.5',
      image_llm text not null default 'openai:gpt-image-2',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

async function ensureProfilesSettingColumns(sql: ReturnType<typeof getSqlClient>): Promise<void> {
  await sql`
    alter table profiles
    add column if not exists fullname text null
  `;
  await sql`
    alter table profiles
    add column if not exists theme text not null default 'system'
  `;
  await sql`
    alter table profiles
    add column if not exists llm text not null default 'openai:gpt-5.5'
  `;
  await sql`
    alter table profiles
    alter column llm set default 'openai:gpt-5.5'
  `;
  await sql`
    alter table profiles
    add column if not exists image_llm text not null default 'openai:gpt-image-2'
  `;
  await sql`
    alter table profiles
    alter column image_llm set default 'openai:gpt-image-2'
  `;
  await sql`
    update profiles
    set llm = 'openai:gpt-5.5'
    where llm = 'openai:gpt-5'
  `;
  await sql`
    update profiles
    set llm = 'openai:gpt-5.5'
    where llm = 'openai:gpt-5.2'
  `;
}

async function ensureProfilesSettingsConstraints(sql: ReturnType<typeof getSqlClient>): Promise<void> {
  await sql`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_theme_check'
      ) then
        alter table profiles
        add constraint profiles_theme_check
        check (theme in ('system', 'light', 'dark'));
      end if;
    end
    $$;
  `;
  await sql`
    do $$
    begin
      if exists (
        select 1
        from pg_constraint
        where conname = 'profiles_llm_check'
      ) then
        alter table profiles
        drop constraint profiles_llm_check;
      end if;
      alter table profiles
      add constraint profiles_llm_check
      check (
        llm = 'none'
        or llm ~ '^(openai|claude|gemini|deepinfra):'
      );
    end
    $$;
  `;
  await sql`
    do $$
    begin
      if exists (
        select 1
        from pg_constraint
        where conname = 'profiles_image_llm_check'
      ) then
        alter table profiles
        drop constraint profiles_image_llm_check;
      end if;
      alter table profiles
      add constraint profiles_image_llm_check
      check (image_llm ~ '^(openai|gemini):');
    end
    $$;
  `;
}

export async function ensureCapsulesTable(): Promise<void> {
  const sql = getSqlClient();
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists capsules (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      name text not null,
      draft jsonb null,
      saved jsonb null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists capsules_email_updated_at_idx
    on capsules (email, updated_at desc)
  `;
  await sql`
    create index if not exists capsules_email_lower_name_idx
    on capsules (email, lower(name))
  `;
}

export async function ensureSharedCapsulesTable(): Promise<void> {
  const sql = getSqlClient();
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists shared_capsules (
      id uuid primary key default gen_random_uuid(),
      profile_email text not null references profiles(email) on delete cascade,
      name text not null,
      content jsonb not null,
      content_hash text not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create unique index if not exists shared_capsules_profile_email_name_hash_idx
    on shared_capsules (profile_email, name, content_hash)
  `;
  await sql`
    create index if not exists shared_capsules_expires_at_idx
    on shared_capsules (expires_at)
  `;
}

export async function ensureSearchTable(): Promise<void> {
  const sql = getSqlClient();
  await sql`
    create table if not exists search (
      email text primary key,
      query text null,
      embedding jsonb null,
      brand text[] not null default '{}'::text[],
      price_min double precision null,
      price_max double precision null,
      audience text[] not null default '{}'::text[],
      category text[] not null default '{}'::text[],
      season text[] not null default '{}'::text[],
      formality_level text[] not null default '{}'::text[],
      style text[] not null default '{}'::text[],
      occasions text[] not null default '{}'::text[],
      color text[] not null default '{}'::text[],
      pattern text[] not null default '{}'::text[],
      silhouette text[] not null default '{}'::text[],
      fit text[] not null default '{}'::text[],
      closure_type text[] not null default '{}'::text[],
      page integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

export async function ensureAuthTables(): Promise<void> {
  await ensureLoginCodesTable();
  await ensureSessionsTable();
}

export async function ensureTables(): Promise<void> {
  await ensureAuthTables();
  await ensureProfilesTable();
  await ensurePasskeysTables();
  await ensureCapsulesTable();
  await ensureSharedCapsulesTable();
  await ensureSearchTable();
}
