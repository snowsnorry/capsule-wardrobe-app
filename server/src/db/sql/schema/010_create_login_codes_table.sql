create table if not exists login_codes (
  email text primary key,
  code_hash text not null,
  nonce text not null default '',
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz null
)
