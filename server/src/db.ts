import { neon } from "@neondatabase/serverless";

const SEARCH_PAGE_SIZE = 50;

type JsonObject = Record<string, unknown>;
type SqlCountResult = { count: number };
type SqlResultLike<TRow = unknown> = TRow[] | SqlCountResult;
type SqlClientLike = {
  <TRow = unknown>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<SqlResultLike<TRow>>;
};
type HasAffectedRowsResult = SqlResultLike<{ id?: string; email?: string }>;

type DatabaseConnectionRow = {
  database: string;
  now: string | Date;
};

type LoginCodeRow = {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: string | Date;
  attempts: number;
  consumedAt: string | Date | null;
};

type SessionRow = {
  sessionId: string;
  email: string;
  csrfToken: string;
  createdAt: string | Date;
  expiresAt: string | Date;
};

type VerifyAndConsumeLoginCodeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not_found" | "expired" | "max_attempts" };

type StringValueRow = { value: string | null };
type BrandOptionRow = { value: string | null; label: string | null };
type BooleanFlagRow = { hasProfile?: unknown };
type NumericRangeRow = { min: unknown; max: unknown };
type CountRow = { total?: unknown };
type FacetRow = { value: unknown; count: unknown };
type PriceBucketRow = { bucket?: unknown; count: unknown; rangeMin: unknown; rangeMax: unknown };

type PriceBucket = {
  key: string;
  min: number;
  max: number;
  count: number;
};

type BucketRangeRow = {
  bucket: number;
  rangeMin: number;
  rangeMax: number;
  count: number;
};

type ProductRow = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  brand: string | null;
  price: number | string | null;
  currency: string | null;
  availability: string | null;
  imageUrl: string | null;
  audience: string | null;
  category: string | null;
  season: string[] | null;
  formalityLevel: string[] | null;
  style: string[] | null;
  occasions: string[] | null;
  colorBase: string[] | null;
  pattern: string | null;
  finish: string | null;
  isNeutral: boolean | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closureType: string[] | null;
};

type ProductSearchRow = ProductRow & {
  distance: number | string | null;
};

type ProductWithEmbeddingRow = ProductRow & JsonObject & {
  embedding?: unknown;
};

type SearchRow = {
  email: string;
  query: string | null;
  embedding: number[] | null;
  brand: string[];
  priceMin: number | null;
  priceMax: number | null;
  audience: string[];
  category: string[];
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  color: string[];
  pattern: string[];
  silhouette: string[];
  fit: string[];
  closureType: string[];
  page: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SearchRowQuery = Omit<SearchRow, "priceMin" | "priceMax"> & {
  embedding: unknown;
  priceMin: unknown;
  priceMax: unknown;
};

type UpsertSearchInput = {
  email: string;
  query: string | null;
  embedding: number[] | null;
  brand: string[];
  priceMin: number | null;
  priceMax: number | null;
  audience: string[];
  category: string[];
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  color: string[];
  pattern: string[];
  silhouette: string[];
  fit: string[];
  closureType: string[];
  page: number;
};

type SearchProductsInput = {
  queryEmbedding?: number[] | null;
  semanticDistanceThreshold?: number | null;
  brand?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  audience?: string[];
  category?: string[];
  season?: string[];
  formalityLevel?: string[];
  style?: string[];
  occasions?: string[];
  color?: string[];
  pattern?: string[];
  silhouette?: string[];
  fit?: string[];
  closureType?: string[];
  page?: number;
};

type SearchProductsResult = {
  items: ProductSearchRow[];
  total: number;
  page: number;
  pageSize: number;
};

type ProfileRow = {
  email: string;
  activeCapsuleId: string | null;
  locale: string;
  fullname: string | null;
  theme: string | null;
  llm: string | null;
  imageLlm: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CreateProfileInput = {
  email: string;
  locale: string;
};

type UpdateProfileInput = {
  email: string;
  locale: string;
  fullname: string | null;
  theme: string;
  llm: string;
  imageLlm: string;
};

type UpdateProfileActiveCapsuleInput = {
  email: string;
  activeCapsuleId: string | null;
};

type CapsuleRow = {
  id: string;
  email: string;
  name: string;
  draft: JsonObject | null;
  saved: JsonObject | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CreateCapsuleInput = {
  email: string;
  name: string;
  draft?: JsonObject | null;
  saved?: JsonObject | null;
};

type CapsuleLookupInput = {
  email: string;
  capsuleId: string;
};

type UpdateCapsuleSnapshotInput = {
  email: string;
  capsuleId: string;
  draft: JsonObject | null;
};

type RenameCapsuleInput = {
  email: string;
  capsuleId: string;
  name: string;
};

let sqlClientOverride: SqlClientLike | null = null;

function getResultRows<TRow>(result: SqlResultLike<TRow>): TRow[] {
  return Array.isArray(result) ? result : [];
}

function getFirstRow<TRow>(result: SqlResultLike<TRow>): TRow | null {
  return getResultRows(result)[0] ?? null;
}

function toOptionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeSearchRow(row: SearchRowQuery | null): SearchRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    embedding: Array.isArray(row.embedding) ? row.embedding.filter((value): value is number => typeof value === "number") : null,
    priceMin: toOptionalNumber(row.priceMin),
    priceMax: toOptionalNumber(row.priceMax)
  };
}

function isPriceBucket(row: PriceBucket | BucketRangeRow): row is PriceBucket {
  return "min" in row && "max" in row;
}

function getSqlClient(): SqlClientLike {
  if (sqlClientOverride) {
    return sqlClientOverride;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is not set");
    (error as Error & { code?: string }).code = "missing_database_url";
    throw error;
  }
  return neon(databaseUrl) as SqlClientLike;
}

function setSqlClientOverride(client: SqlClientLike | null | undefined): void {
  sqlClientOverride = client || null;
}

async function checkDatabaseConnection(): Promise<DatabaseConnectionRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<DatabaseConnectionRow>`
    select
      current_database() as database,
      now() as now
  `);
  return row;
}

async function ensureLoginCodesTable(): Promise<void> {
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

async function ensureSessionsTable(): Promise<void> {
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

async function ensureProfilesTable(): Promise<void> {
  const sql = getSqlClient();
  await sql`
    create table if not exists profiles (
      email text primary key,
      active_capsule_id uuid null,
      locale text not null,
      fullname text null,
      theme text not null default 'system',
      llm text not null default 'openai:gpt-5.4',
      image_llm text not null default 'openai:gpt-image-2',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
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
    add column if not exists llm text not null default 'openai:gpt-5.4'
  `;
  await sql`
    alter table profiles
    alter column llm set default 'openai:gpt-5.4'
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
    set llm = 'openai:gpt-5.4'
    where llm = 'openai:gpt-5'
  `;
  await sql`
    update profiles
    set llm = 'openai:gpt-5.4'
    where llm = 'openai:gpt-5.2'
  `;
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

async function ensureCapsulesTable(): Promise<void> {
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

async function ensureSearchTable(): Promise<void> {
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

async function ensureAuthTables(): Promise<void> {
  await ensureLoginCodesTable();
  await ensureSessionsTable();
}

async function ensureTables(): Promise<void> {
  await ensureAuthTables();
  await ensureProfilesTable();
  await ensureCapsulesTable();
  await ensureSearchTable();
}

async function pruneLoginCodes(): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from login_codes where "expiresAt" <= now() or "consumedAt" is not null`;
}

async function upsertLoginCode({
  email,
  codeHash,
  nonce,
  expiresAt
}: {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: Date;
}): Promise<void> {
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

async function getLoginCodeByEmail(email: string): Promise<LoginCodeRow | null> {
  const sql = getSqlClient();
  const entry = getFirstRow(await sql<LoginCodeRow>`
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
  `);
  return entry || null;
}

async function verifyAndConsumeLoginCode({
  email,
  codeHash,
  maxAttempts
}: {
  email: string;
  codeHash: string;
  maxAttempts: number;
}): Promise<VerifyAndConsumeLoginCodeResult> {
  const sql = getSqlClient();

  const consumed = getFirstRow(await sql<{ email: string }>`
    update login_codes
    set "consumedAt" = now()
    where
      email = ${email}
      and "consumedAt" is null
      and "expiresAt" > now()
      and attempts < ${maxAttempts}
      and "codeHash" = ${codeHash}
    returning email
  `);
  if (consumed) {
    return { ok: true };
  }

  const incremented = getFirstRow(await sql<{ attempts: number }>`
    update login_codes
    set attempts = attempts + 1
    where
      email = ${email}
      and "consumedAt" is null
      and "expiresAt" > now()
      and attempts < ${maxAttempts}
      and "codeHash" <> ${codeHash}
    returning attempts
  `);
  if (incremented) {
    return { ok: false, reason: "invalid" };
  }

  const entry = getFirstRow(await sql<Pick<LoginCodeRow, "expiresAt" | "attempts" | "consumedAt">>`
    select "expiresAt", attempts, "consumedAt"
    from login_codes
    where email = ${email}
    limit 1
  `);
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

async function insertSession({
  sessionId,
  email,
  csrfToken,
  createdAt,
  expiresAt
}: SessionRow): Promise<void> {
  const sql = getSqlClient();
  await sql`
    insert into user_sessions ("sessionId", email, "csrfToken", "createdAt", "expiresAt")
    values (${sessionId}, ${email}, ${csrfToken}, ${createdAt}, ${expiresAt})
  `;
}

async function getSessionById(sessionId: string): Promise<SessionRow | null> {
  const sql = getSqlClient();
  const session = getFirstRow(await sql<SessionRow>`
    select "sessionId", email, "csrfToken", "createdAt", "expiresAt"
    from user_sessions
    where "sessionId" = ${sessionId}
    limit 1
  `);
  return session || null;
}

async function deleteSessionById(sessionId: string): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from user_sessions where "sessionId" = ${sessionId}`;
}

async function pruneExpiredSessions(): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from user_sessions where "expiresAt" <= now()`;
}

async function hasProfileByEmail(email: string): Promise<boolean> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<BooleanFlagRow>`
    select exists(select 1 from profiles where email = ${email}) as "hasProfile"
  `);
  return Boolean(row?.hasProfile);
}

async function getDistinctProductFormalityLevels(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(formality_level, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductOccasions(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(occasions, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductSeasons(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(season, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductPatterns(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct
      lower(trim(pattern)) as value
    from products
    where
      nullif(trim(pattern), '') is not null
    order by value asc
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductBrands(): Promise<Array<{ value: string; label: string }>> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<BrandOptionRow>`
    with ranked_brands as (
      select
        lower(trim(brand)) as value,
        trim(brand) as label,
        count(*) as usage_count,
        row_number() over (
          partition by lower(trim(brand))
          order by count(*) desc, trim(brand) asc
        ) as row_number
      from products
      where nullif(trim(brand), '') is not null
      group by lower(trim(brand)), trim(brand)
    )
    select value, label
    from ranked_brands
    where row_number = 1
    order by value asc
  `);
  return rows
    .map((row) => ({
      value: row.value,
      label: row.label
    }))
    .filter((row) => row.value && row.label);
}

async function getDistinctProductCategories(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct lower(trim(category)) as value
    from products
    where nullif(trim(category), '') is not null
    order by value asc
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductSilhouettes(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct lower(trim(silhouette)) as value
    from products
    where nullif(trim(silhouette), '') is not null
    order by value asc
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductFits(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct lower(trim(fit)) as value
    from products
    where nullif(trim(fit), '') is not null
    order by value asc
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductClosureTypes(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct lower(trim(value)) as value
    from products
    cross join unnest(coalesce(closure_type, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value asc
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getDistinctProductColors(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<StringValueRow>`
    select distinct lower(trim(value)) as value
    from products
    cross join unnest(coalesce(color_base, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value asc
  `);
  return rows.map((row) => row.value).filter(Boolean);
}

async function getProductPriceRange(): Promise<{ min: number | null; max: number | null }> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<NumericRangeRow>`
    select
      min(price) as min,
      max(price) as max
    from products
    where price is not null
  `);
  return {
    min: toOptionalNumber(row?.min),
    max: toOptionalNumber(row?.max)
  };
}

async function getProductsByUrlsInOrder(urls: unknown[] = []): Promise<ProductRow[]> {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  const normalizedUrls = urls
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (normalizedUrls.length === 0) {
    return [];
  }

  return getResultRows(await sql<ProductRow>`
    select
      products.id,
      products.name,
      products.url,
      products.description,
      products.brand,
      products.price,
      products.currency,
      products.availability,
      products.image_url as "imageUrl",
      products.audience,
      products.category,
      products.season,
      products.formality_level as "formalityLevel",
      products.style,
      products.occasions,
      products.color_base as "colorBase",
      products.pattern,
      products.finish,
      products.is_neutral as "isNeutral",
      products.composition,
      products.silhouette,
      products.fit,
      products.closure_type as "closureType"
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join products on products.url = selected.url
    order by selected.position asc
  `);
}

async function getProductsWithEmbeddingsByUrlsInOrder(urls: unknown[] = []): Promise<ProductWithEmbeddingRow[]> {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  const normalizedUrls = urls
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (normalizedUrls.length === 0) {
    return [];
  }

  return getResultRows(await sql<ProductWithEmbeddingRow>`
    select
      products.*,
      products.image_url as "imageUrl",
      products.formality_level as "formalityLevel",
      products.color_base as "colorBase",
      products.is_neutral as "isNeutral",
      products.closure_type as "closureType"
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join products on products.url = selected.url
    order by selected.position asc
  `);
}

async function getSearchByEmail(email: string): Promise<SearchRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<SearchRowQuery>`
    select
      email,
      query,
      embedding,
      brand,
      price_min as "priceMin",
      price_max as "priceMax",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color,
      pattern,
      silhouette,
      fit,
      closure_type as "closureType",
      page,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from search
    where email = ${email}
    limit 1
  `);
  return normalizeSearchRow(row);
}

async function upsertSearchByEmail({
  email,
  query,
  embedding,
  brand,
  priceMin,
  priceMax,
  audience,
  category,
  season,
  formalityLevel,
  style,
  occasions,
  color,
  pattern,
  silhouette,
  fit,
  closureType,
  page
}: UpsertSearchInput): Promise<SearchRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<SearchRowQuery>`
    insert into search (
      email,
      query,
      embedding,
      brand,
      price_min,
      price_max,
      audience,
      category,
      season,
      formality_level,
      style,
      occasions,
      color,
      pattern,
      silhouette,
      fit,
      closure_type,
      page
    )
    values (
      ${email},
      ${query},
      ${embedding === null ? null : JSON.stringify(embedding)},
      ${brand},
      ${priceMin},
      ${priceMax},
      ${audience},
      ${category},
      ${season},
      ${formalityLevel},
      ${style},
      ${occasions},
      ${color},
      ${pattern},
      ${silhouette},
      ${fit},
      ${closureType},
      ${page}
    )
    on conflict (email)
    do update set
      query = excluded.query,
      embedding = excluded.embedding,
      brand = excluded.brand,
      price_min = excluded.price_min,
      price_max = excluded.price_max,
      audience = excluded.audience,
      category = excluded.category,
      season = excluded.season,
      formality_level = excluded.formality_level,
      style = excluded.style,
      occasions = excluded.occasions,
      color = excluded.color,
      pattern = excluded.pattern,
      silhouette = excluded.silhouette,
      fit = excluded.fit,
      closure_type = excluded.closure_type,
      page = excluded.page,
      updated_at = now()
    returning
      email,
      query,
      embedding,
      brand,
      price_min as "priceMin",
      price_max as "priceMax",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color,
      pattern,
      silhouette,
      fit,
      closure_type as "closureType",
      page,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return normalizeSearchRow(row);
}

async function searchProducts({
  queryEmbedding = null,
  semanticDistanceThreshold = null,
  brand = [],
  priceMin = null,
  priceMax = null,
  audience = [],
  category = [],
  season = [],
  formalityLevel = [],
  style = [],
  occasions = [],
  color = [],
  pattern = [],
  silhouette = [],
  fit = [],
  closureType = [],
  page = 1
}: SearchProductsInput = {}): Promise<SearchProductsResult> {
  const sql = getSqlClient();
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (currentPage - 1) * SEARCH_PAGE_SIZE;
  const embeddingVector = Array.isArray(queryEmbedding) && queryEmbedding.length > 0
    ? `[${queryEmbedding.join(",")}]`
    : null;

  const countRow = getFirstRow(await sql<CountRow>`
    select count(*)::integer as total
    from products
    where
      (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
      and (${priceMin}::double precision is null or price >= ${priceMin})
      and (${priceMax}::double precision is null or price <= ${priceMax})
      and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
      and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
      and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
      and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
      and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
      and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
      and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
      and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
      and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
      and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
      and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      and (
        ${embeddingVector}::text is null
        or ${semanticDistanceThreshold}::double precision is null
        or embedding <=> ${embeddingVector}::vector <= ${semanticDistanceThreshold}
      )
  `);

  const items = getResultRows(await sql<ProductSearchRow>`
    select
      id,
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      case
        when ${embeddingVector}::text is null then null
        else embedding <=> ${embeddingVector}::vector
      end as distance
    from products
    where
      (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
      and (${priceMin}::double precision is null or price >= ${priceMin})
      and (${priceMax}::double precision is null or price <= ${priceMax})
      and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
      and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
      and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
      and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
      and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
      and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
      and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
      and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
      and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
      and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
      and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      and (
        ${embeddingVector}::text is null
        or ${semanticDistanceThreshold}::double precision is null
        or embedding <=> ${embeddingVector}::vector <= ${semanticDistanceThreshold}
      )
    order by
      case when ${embeddingVector}::text is null then 1 else 0 end asc,
      case
        when ${embeddingVector}::text is null then null
        else embedding <=> ${embeddingVector}::vector
      end asc nulls last,
      lower(coalesce(brand, '')) asc,
      lower(coalesce(name, '')) asc
    limit ${SEARCH_PAGE_SIZE}
    offset ${offset}
  `);

  return {
    items,
    total: Number(countRow?.total || 0),
    page: currentPage,
    pageSize: SEARCH_PAGE_SIZE
  };
}

function normalizeFacetRows(rows: FacetRow[] = []): Array<{ value: string; count: number }> {
  return rows
    .map((row) => ({
      value: String(row?.value || "").trim().toLowerCase(),
      count: Number(row?.count || 0)
    }))
    .filter((row) => row.value && row.count > 0);
}

function buildPriceBuckets(rows: PriceBucketRow[] = [], bucketCount: number): PriceBucket[] {
  const normalizedRows = rows
    .map((row) => {
      const bucket = Number(row?.bucket || 0);
      const count = Number(row?.count || 0);
      const rangeMin = Number(row?.rangeMin);
      const rangeMax = Number(row?.rangeMax);

      if (
        !Number.isInteger(bucket) ||
        bucket <= 0 ||
        count < 0 ||
        !Number.isFinite(rangeMin) ||
        !Number.isFinite(rangeMax)
      ) {
        return null;
      }

      if (rangeMin === rangeMax) {
        return {
          key: `${rangeMin}:${rangeMax}`,
          min: rangeMin,
          max: rangeMax,
          count
        };
      }

      return {
        bucket,
        rangeMin,
        rangeMax,
        count
      };
    })
    .filter((row): row is PriceBucket | BucketRangeRow => Boolean(row));

  if (normalizedRows.length === 0) {
    return [];
  }

  const firstRow = normalizedRows[0];
  if (isPriceBucket(firstRow)) {
    return [{ key: `${firstRow.min}:${firstRow.max}`, min: firstRow.min, max: firstRow.max, count: firstRow.count }];
  }

  const rangeRows = normalizedRows.filter((row): row is BucketRangeRow => !isPriceBucket(row));
  const { rangeMin, rangeMax } = firstRow;
  const countByBucket = new Map(rangeRows.map((row) => [row.bucket, row.count]));
  const step = (rangeMax - rangeMin) / bucketCount;

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucket = index + 1;
    const min = rangeMin + step * index;
    const max = bucket === bucketCount ? rangeMax : rangeMin + step * bucket;

    return {
      key: `${min}:${max}`,
      min,
      max,
      count: countByBucket.get(bucket) || 0
    };
  });
}

async function searchProductStats({
  brand = [],
  priceMin = null,
  priceMax = null,
  audience = [],
  category = [],
  season = [],
  formalityLevel = [],
  style = [],
  occasions = [],
  color = [],
  pattern = [],
  silhouette = [],
  fit = [],
  closureType = []
}: Omit<SearchProductsInput, "queryEmbedding" | "semanticDistanceThreshold" | "page"> = {}): Promise<{
  total: number;
  stats: {
    brand: Array<{ value: string; count: number }>;
    category: Array<{ value: string; count: number }>;
    season: Array<{ value: string; count: number }>;
    audience: Array<{ value: string; count: number }>;
    formalityLevel: Array<{ value: string; count: number }>;
    style: Array<{ value: string; count: number }>;
    occasions: Array<{ value: string; count: number }>;
    color: Array<{ value: string; count: number }>;
    pattern: Array<{ value: string; count: number }>;
    silhouette: Array<{ value: string; count: number }>;
    fit: Array<{ value: string; count: number }>;
    closureType: Array<{ value: string; count: number }>;
  };
  priceBuckets: PriceBucket[];
}> {
  const sql = getSqlClient();
  const priceBucketCount = 100;

  const [countRow, brandRows, categoryRows, seasonRows, audienceRows, formalityRows, styleRows, occasionRows, colorRows, patternRows, silhouetteRows, fitRows, closureTypeRows, priceRows] = await Promise.all([
    sql<CountRow>`
      select count(*)::integer as total
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
        and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
        and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
        and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
    `,
    sql<FacetRow>`
      select lower(coalesce(brand, '')) as value, count(*)::integer as count
      from products
      where
        (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
        and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
        and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
        and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
        and coalesce(brand, '') <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(coalesce(category, '')) as value, count(*)::integer as count
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
        and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
        and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
        and coalesce(category, '') <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(season, array[]::text[])) as value
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
          and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
          and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
          and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
          and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      ) values_table
      where value <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(coalesce(audience, '')) as value, count(*)::integer as count
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
        and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
        and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
        and coalesce(audience, '') <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(formality_level, array[]::text[])) as value
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
          and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
          and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
          and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
          and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      ) values_table
      where value <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(style, array[]::text[])) as value
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
          and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
          and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
          and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
          and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      ) values_table
      where value <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(occasions, array[]::text[])) as value
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
          and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
          and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
          and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
          and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      ) values_table
      where value <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(color_base, array[]::text[])) as value
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
          and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
          and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
          and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
          and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      ) values_table
      where value <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(coalesce(pattern, '')) as value, count(*)::integer as count
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
        and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
        and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
        and coalesce(pattern, '') <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(coalesce(silhouette, '')) as value, count(*)::integer as count
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
        and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
        and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
        and coalesce(silhouette, '') <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(coalesce(fit, '')) as value, count(*)::integer as count
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
        and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
        and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
        and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
        and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
        and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
        and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
        and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
        and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
        and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
        and coalesce(fit, '') <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<FacetRow>`
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(closure_type, array[]::text[])) as value
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
          and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
          and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
          and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
          and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
      ) values_table
      where value <> ''
      group by 1
      order by count desc, value asc
    `,
    sql<PriceBucketRow>`
      with filtered as (
        select price
        from products
        where
          (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
          and (${priceMin}::double precision is null or price >= ${priceMin})
          and (${priceMax}::double precision is null or price <= ${priceMax})
          and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
          and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
          and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
          and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
          and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
          and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
          and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
          and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
          and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
          and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
          and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
          and price is not null
      ),
      bounds as (
        select min(price) as min_price, max(price) as max_price
        from filtered
      ),
      bucketed as (
        select
          case
            when bounds.min_price is null or bounds.max_price is null then null
            when bounds.min_price = bounds.max_price then 1
            else least(width_bucket(filtered.price, bounds.min_price, bounds.max_price, ${priceBucketCount}), ${priceBucketCount})
          end as bucket,
          bounds.min_price as "rangeMin",
          bounds.max_price as "rangeMax"
        from filtered
        cross join bounds
      )
      select
        bucket,
        count(*)::integer as count,
        min("rangeMin") as "rangeMin",
        max("rangeMax") as "rangeMax"
      from bucketed
      where bucket is not null
      group by bucket
      order by bucket asc
    `
  ]);

  return {
    total: Number(getFirstRow(countRow)?.total || 0),
    stats: {
      brand: normalizeFacetRows(getResultRows(brandRows)),
      category: normalizeFacetRows(getResultRows(categoryRows)),
      season: normalizeFacetRows(getResultRows(seasonRows)),
      audience: normalizeFacetRows(getResultRows(audienceRows)),
      formalityLevel: normalizeFacetRows(getResultRows(formalityRows)),
      style: normalizeFacetRows(getResultRows(styleRows)),
      occasions: normalizeFacetRows(getResultRows(occasionRows)),
      color: normalizeFacetRows(getResultRows(colorRows)),
      pattern: normalizeFacetRows(getResultRows(patternRows)),
      silhouette: normalizeFacetRows(getResultRows(silhouetteRows)),
      fit: normalizeFacetRows(getResultRows(fitRows)),
      closureType: normalizeFacetRows(getResultRows(closureTypeRows))
    },
    priceBuckets: buildPriceBuckets(getResultRows(priceRows), priceBucketCount)
  };
}

async function getProfileByEmail(email: string): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<ProfileRow>`
    select
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from profiles
    where email = ${email}
    limit 1
  `);
  return row || null;
}

async function createProfileRecord({
  email,
  locale
}: CreateProfileInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<ProfileRow>`
    insert into profiles (
      email,
      active_capsule_id,
      locale
    )
    values (
      ${email},
      null,
      ${locale}
    )
    on conflict (email) do nothing
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function updateProfileLocaleByEmail({ email, locale }: CreateProfileInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<ProfileRow>`
    update profiles
    set
      locale = ${locale},
      updated_at = now()
    where email = ${email}
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function updateProfileByEmail({
  email,
  locale,
  fullname,
  theme,
  llm,
  imageLlm
}: UpdateProfileInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<ProfileRow>`
    update profiles
    set
      locale = ${locale},
      fullname = ${fullname},
      theme = ${theme},
      llm = ${llm},
      image_llm = ${imageLlm},
      updated_at = now()
    where email = ${email}
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function updateProfileActiveCapsuleIdByEmail({
  email,
  activeCapsuleId
}: UpdateProfileActiveCapsuleInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<ProfileRow>`
    update profiles
    set
      active_capsule_id = ${activeCapsuleId},
      updated_at = now()
    where email = ${email}
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function createCapsuleRecord({
  email,
  name,
  draft = null,
  saved = null
}: CreateCapsuleInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<CapsuleRow>`
    insert into capsules (
      email,
      name,
      draft,
      saved
    )
    values (
      ${email},
      ${name},
      ${draft === null ? null : JSON.stringify(draft)},
      ${saved === null ? null : JSON.stringify(saved)}
    )
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function getCapsuleByIdForEmail({ email, capsuleId }: CapsuleLookupInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<CapsuleRow>`
    select
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from capsules
    where email = ${email} and id = ${capsuleId}
    limit 1
  `);
  return row || null;
}

async function listRecentCapsulesByEmail({
  email,
  limit = 10
}: {
  email: string;
  limit?: number;
}): Promise<CapsuleRow[]> {
  const sql = getSqlClient();
  return getResultRows(await sql<CapsuleRow>`
    select
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from capsules
    where email = ${email}
    order by updated_at desc, created_at desc
    limit ${limit}
  `);
}

async function searchCapsulesByEmail({
  email,
  query,
  limit = 25
}: {
  email: string;
  query: string;
  limit?: number;
}): Promise<CapsuleRow[]> {
  const sql = getSqlClient();
  const normalizedQuery = `%${String(query || "").trim().toLowerCase()}%`;
  return getResultRows(await sql<CapsuleRow>`
    select
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from capsules
    where email = ${email}
      and lower(name) like ${normalizedQuery}
    order by updated_at desc, created_at desc
    limit ${limit}
  `);
}

async function listCapsuleNamesByEmail(email: string): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(await sql<{ name: string | null }>`
    select name
    from capsules
    where email = ${email}
  `);
  return rows.map((row) => String(row?.name || "").trim()).filter(Boolean);
}

async function updateCapsuleSnapshotByIdForEmail({
  email,
  capsuleId,
  draft
}: UpdateCapsuleSnapshotInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<CapsuleRow>`
    update capsules
    set
      draft = ${draft === null ? null : JSON.stringify(draft)},
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function renameCapsuleByIdForEmail({
  email,
  capsuleId,
  name
}: RenameCapsuleInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<CapsuleRow>`
    update capsules
    set
      name = ${name},
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function saveCapsuleByIdForEmail({ email, capsuleId }: CapsuleLookupInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<CapsuleRow>`
    update capsules
    set
      saved = coalesce(draft, saved),
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function revertCapsuleDraftByIdForEmail({ email, capsuleId }: CapsuleLookupInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(await sql<CapsuleRow>`
    update capsules
    set
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `);
  return row || null;
}

async function deleteCapsuleByIdForEmail({ email, capsuleId }: CapsuleLookupInput): Promise<boolean> {
  const sql = getSqlClient();
  const result = await sql`
    delete from capsules
    where email = ${email} and id = ${capsuleId}
    returning id
  `;
  return hasAffectedRows(result);
}

function hasAffectedRows(result: HasAffectedRowsResult | null | undefined): boolean {
  if (Array.isArray(result)) {
    return result.length > 0;
  }
  if (result && typeof result.count === "number") {
    return result.count > 0;
  }
  return false;
}

async function deleteProfileByEmail(email: string): Promise<boolean> {
  const sql = getSqlClient();
  await sql`
    delete from capsules
    where email = ${email}
  `;
  const result = await sql`
    delete from profiles
    where email = ${email}
    returning email
  `;
  return hasAffectedRows(result);
}

export {
  getSqlClient,
  setSqlClientOverride,
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
  getDistinctProductBrands,
  getDistinctProductCategories,
  getDistinctProductSilhouettes,
  getDistinctProductFits,
  getDistinctProductClosureTypes,
  getDistinctProductColors,
  getProductPriceRange,
  buildPriceBuckets,
  getProductsByUrlsInOrder,
  getProductsWithEmbeddingsByUrlsInOrder,
  getSearchByEmail,
  upsertSearchByEmail,
  searchProducts,
  searchProductStats,
  getProfileByEmail,
  createProfileRecord,
  updateProfileByEmail,
  updateProfileLocaleByEmail,
  updateProfileActiveCapsuleIdByEmail,
  createCapsuleRecord,
  getCapsuleByIdForEmail,
  listRecentCapsulesByEmail,
  searchCapsulesByEmail,
  listCapsuleNamesByEmail,
  updateCapsuleSnapshotByIdForEmail,
  renameCapsuleByIdForEmail,
  saveCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  deleteCapsuleByIdForEmail,
  hasAffectedRows,
  deleteProfileByEmail
};
