create table if not exists capsules (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  pin boolean not null default false,
  draft jsonb null,
  saved jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
