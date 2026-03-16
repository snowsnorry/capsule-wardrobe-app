import { neon } from "@neondatabase/serverless";

function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is not set");
    error.code = "missing_database_url";
    throw error;
  }
  return neon(databaseUrl);
}

async function checkDatabaseConnection() {
  const sql = getSqlClient();
  const [row] = await sql`
    select
      current_database() as database,
      now() as now
  `;
  return row;
}

async function ensureLoginCodesTable() {
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
  await sql`
    alter table login_codes
    add column if not exists nonce text not null default ''
  `;
}

async function ensureSessionsTable() {
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

async function ensureProfilesTable() {
  const sql = getSqlClient();
  await sql`
    create table if not exists profiles (
      email text primary key,
      formality_level text null,
      style text null,
      occasions text[] not null,
      season text[] not null default array['spring', 'summer', 'autumn', 'winter']::text[],
      audience text not null default 'any',
      color text null,
      pattern text null,
      items jsonb null,
      locale text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

async function ensureAuthTables() {
  await ensureLoginCodesTable();
  await ensureSessionsTable();
}

async function ensureTables() {
  await ensureAuthTables();
  await ensureProfilesTable();
}

async function pruneLoginCodes() {
  const sql = getSqlClient();
  await sql`delete from login_codes where "expiresAt" <= now() or "consumedAt" is not null`;
}

async function upsertLoginCode({ email, codeHash, nonce, expiresAt }) {
  const sql = getSqlClient();
  await sql`
    insert into login_codes (email, "codeHash", nonce, "expiresAt", attempts, "consumedAt")
    values (${email}, ${codeHash}, ${nonce}, ${expiresAt}, 0, null)
    on conflict (email)
    do update set
      "codeHash" = excluded."codeHash",
      nonce = excluded.nonce,
      "expiresAt" = excluded."expiresAt",
      attempts = 0,
      "consumedAt" = null
  `;
}

async function getLoginCodeByEmail(email) {
  const sql = getSqlClient();
  const [entry] = await sql`
    select
      email,
      "codeHash",
      nonce,
      "expiresAt",
      attempts,
      "consumedAt"
    from login_codes
    where email = ${email}
    limit 1
  `;
  return entry || null;
}

async function verifyAndConsumeLoginCode({ email, codeHash, maxAttempts }) {
  const sql = getSqlClient();

  const [consumed] = await sql`
    update login_codes
    set "consumedAt" = now()
    where
      email = ${email}
      and "consumedAt" is null
      and "expiresAt" > now()
      and attempts < ${maxAttempts}
      and "codeHash" = ${codeHash}
    returning email
  `;
  if (consumed) {
    return { ok: true };
  }

  const [incremented] = await sql`
    update login_codes
    set attempts = attempts + 1
    where
      email = ${email}
      and "consumedAt" is null
      and "expiresAt" > now()
      and attempts < ${maxAttempts}
      and "codeHash" <> ${codeHash}
    returning attempts
  `;
  if (incremented) {
    return { ok: false, reason: "invalid" };
  }

  const [entry] = await sql`
    select "expiresAt", attempts, "consumedAt"
    from login_codes
    where email = ${email}
    limit 1
  `;
  if (!entry) {
    return { ok: false, reason: "not_found" };
  }

  if (entry.consumedAt) {
    return { ok: false, reason: "invalid" };
  }

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    await sql`delete from login_codes where email = ${email}`;
    return { ok: false, reason: "expired" };
  }

  if (entry.attempts >= maxAttempts) {
    await sql`delete from login_codes where email = ${email}`;
    return { ok: false, reason: "max_attempts" };
  }

  return { ok: false, reason: "invalid" };
}

async function insertSession({ sessionId, email, csrfToken, createdAt, expiresAt }) {
  const sql = getSqlClient();
  await sql`
    insert into user_sessions ("sessionId", email, "csrfToken", "createdAt", "expiresAt")
    values (${sessionId}, ${email}, ${csrfToken}, ${createdAt}, ${expiresAt})
  `;
}

async function getSessionById(sessionId) {
  const sql = getSqlClient();
  const [session] = await sql`
    select "sessionId", email, "csrfToken", "createdAt", "expiresAt"
    from user_sessions
    where "sessionId" = ${sessionId}
    limit 1
  `;
  return session || null;
}

async function deleteSessionById(sessionId) {
  const sql = getSqlClient();
  await sql`delete from user_sessions where "sessionId" = ${sessionId}`;
}

async function pruneExpiredSessions() {
  const sql = getSqlClient();
  await sql`delete from user_sessions where "expiresAt" <= now()`;
}

async function hasProfileByEmail(email) {
  const sql = getSqlClient();
  const [row] = await sql`
    select exists(select 1 from profiles where email = ${email}) as "hasProfile"
  `;
  return Boolean(row?.hasProfile);
}

async function getDistinctProductFormalityLevels() {
  const sql = getSqlClient();
  const rows = await sql`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(formality_level, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `;
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductOccasions() {
  const sql = getSqlClient();
  const rows = await sql`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(occasions, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `;
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductSeasons() {
  const sql = getSqlClient();
  const rows = await sql`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(season, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `;
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductPatterns() {
  const sql = getSqlClient();
  const rows = await sql`
    select distinct
      lower(trim(pattern)) as value
    from products
    where
      nullif(trim(pattern), '') is not null
    order by value asc
  `;
  return rows.map((row) => row.value).filter(Boolean);
}

async function getProfileByEmail(email) {
  const sql = getSqlClient();
  const [row] = await sql`
    select
      email,
      formality_level as "formalityLevel",
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
      items,
      locale,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from profiles
    where email = ${email}
    limit 1
  `;
  return row || null;
}

async function createProfileRecord({
  email,
  formalityLevel,
  style,
  occasions,
  season,
  audience,
  color,
  pattern,
  locale
}) {
  const sql = getSqlClient();
  const [row] = await sql`
    insert into profiles (
      email,
      formality_level,
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
      items,
      locale
    )
    values (
      ${email},
      ${formalityLevel},
      ${style},
      ${occasions},
      ${season},
      ${audience},
      ${color},
      ${pattern},
      null,
      ${locale}
    )
    on conflict (email) do nothing
    returning
      email,
      formality_level as "formalityLevel",
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
      items,
      locale,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  return row || null;
}

async function updateProfileRecord({
  email,
  formalityLevel,
  style,
  occasions,
  season,
  audience,
  color,
  pattern,
  locale
}) {
  const sql = getSqlClient();
  const [row] = await sql`
    update profiles
    set
      items = case
        when formality_level is distinct from ${formalityLevel}
          or style is distinct from ${style}
          or occasions is distinct from ${occasions}
          or season is distinct from ${season}
          or audience is distinct from ${audience}
          or color is distinct from ${color}
          or pattern is distinct from ${pattern}
        then null
        else items
      end,
      formality_level = ${formalityLevel},
      style = ${style},
      occasions = ${occasions},
      season = ${season},
      audience = ${audience},
      color = ${color},
      pattern = ${pattern},
      locale = ${locale},
      updated_at = now()
    where email = ${email}
    returning
      email,
      formality_level as "formalityLevel",
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
      items,
      locale,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  return row || null;
}

async function updateProfileLocaleByEmail({ email, locale }) {
  const sql = getSqlClient();
  const [row] = await sql`
    update profiles
    set
      locale = ${locale},
      updated_at = now()
    where email = ${email}
    returning
      email,
      formality_level as "formalityLevel",
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
      items,
      locale,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  return row || null;
}

async function updateProfileItemsByEmail({ email, items }) {
  const sql = getSqlClient();
  const [row] = await sql`
    update profiles
    set
      items = ${items === null ? null : JSON.stringify(items)},
      updated_at = now()
    where email = ${email}
    returning
      email,
      formality_level as "formalityLevel",
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
      items,
      locale,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  return row || null;
}

function hasAffectedRows(result) {
  if (Array.isArray(result)) {
    return result.length > 0;
  }
  if (result && typeof result.count === "number") {
    return result.count > 0;
  }
  return false;
}

async function deleteProfileByEmail(email) {
  const sql = getSqlClient();
  const result = await sql`
    delete from profiles
    where email = ${email}
    returning email
  `;
  return hasAffectedRows(result);
}

export {
  getSqlClient,
  checkDatabaseConnection,
  ensureTables,
  pruneLoginCodes,
  upsertLoginCode,
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  pruneExpiredSessions,
  hasProfileByEmail,
  getDistinctProductFormalityLevels,
  getDistinctProductOccasions,
  getDistinctProductSeasons,
  getDistinctProductPatterns,
  getProfileByEmail,
  createProfileRecord,
  updateProfileRecord,
  updateProfileLocaleByEmail,
  updateProfileItemsByEmail,
  hasAffectedRows,
  deleteProfileByEmail
};
