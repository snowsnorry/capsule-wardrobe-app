create index if not exists mcp_oauth_refresh_tokens_active_idx
on mcp_oauth_refresh_tokens (client_id, resource, expires_at)
where revoked_at is null and consumed_at is null
