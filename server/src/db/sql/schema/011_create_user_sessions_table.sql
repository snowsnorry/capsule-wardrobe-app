create table if not exists user_sessions (
  "sessionId" text primary key,
  email text not null,
  "csrfToken" text not null default '',
  "createdAt" timestamptz not null,
  "expiresAt" timestamptz not null
)
