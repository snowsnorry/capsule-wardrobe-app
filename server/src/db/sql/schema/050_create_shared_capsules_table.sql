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
