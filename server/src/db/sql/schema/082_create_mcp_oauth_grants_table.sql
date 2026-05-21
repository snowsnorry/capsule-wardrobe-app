create table if not exists mcp_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  client_id text not null,
  scopes text not null,
  resource text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
)
