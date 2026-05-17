create table if not exists passkey_challenges (
  id text primary key,
  kind text not null,
  challenge text not null,
  profile_email text null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
)
