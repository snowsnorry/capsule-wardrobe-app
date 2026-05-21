create table if not exists mcp_oauth_registered_clients (
  client_id text primary key,
  client_name text null,
  redirect_uris jsonb not null,
  scope text null,
  token_endpoint_auth_method text not null default 'none',
  grant_types text not null default 'authorization_code',
  response_types text not null default 'code',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mcp_oauth_registered_clients_redirect_uris_array_check
    check (jsonb_typeof(redirect_uris) = 'array'),
  constraint mcp_oauth_registered_clients_public_check
    check (token_endpoint_auth_method = 'none'),
  constraint mcp_oauth_registered_clients_grant_types_check
    check (grant_types in ('authorization_code', 'authorization_code refresh_token')),
  constraint mcp_oauth_registered_clients_response_types_check
    check (response_types = 'code')
)
