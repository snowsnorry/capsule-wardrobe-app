alter table mcp_oauth_registered_clients
  drop constraint if exists mcp_oauth_registered_clients_grant_types_check,
  add constraint mcp_oauth_registered_clients_grant_types_check
    check (grant_types in ('authorization_code', 'authorization_code refresh_token'))
