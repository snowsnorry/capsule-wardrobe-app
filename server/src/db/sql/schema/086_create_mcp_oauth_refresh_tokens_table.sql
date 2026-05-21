create table if not exists mcp_oauth_refresh_tokens (
  token_hash text primary key,
  user_email text not null,
  client_id text not null,
  scopes text not null,
  resource text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz null
)
