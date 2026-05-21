create table if not exists mcp_oauth_authorization_codes (
  code_hash text primary key,
  user_email text not null,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null,
  scopes text not null,
  resource text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
)
