import { getSqlClient } from "./core.js";

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
