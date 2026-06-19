create table if not exists personal_items_reports (
  email text primary key references profiles(email) on delete cascade,
  report jsonb not null,
  personal_item_urls text[] not null,
  generated_at timestamptz not null default now()
)
