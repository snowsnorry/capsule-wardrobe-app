create table if not exists user_sessions (
  session_id text primary key,
  email text not null,
  csrf_token text not null default '',
  created_at timestamptz not null,
  expires_at timestamptz not null
)
