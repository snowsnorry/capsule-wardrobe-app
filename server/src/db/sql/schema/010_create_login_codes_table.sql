create table if not exists login_codes (
  email text primary key,
  "codeHash" text not null,
  nonce text not null default '',
  "expiresAt" timestamptz not null,
  attempts integer not null default 0,
  "consumedAt" timestamptz null
)
