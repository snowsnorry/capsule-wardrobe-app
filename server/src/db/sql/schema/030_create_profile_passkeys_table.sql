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
