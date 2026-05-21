create index if not exists mcp_oauth_grants_active_idx
on mcp_oauth_grants (user_email, client_id, resource, scopes)
where revoked_at is null
