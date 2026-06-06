create table if not exists user_liked_items (
  user_email text not null references profiles(email) on delete cascade,
  item_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_email, item_url),
  constraint user_liked_items_item_url_scheme_check
    check (item_url ~* '^(https?://|wardrobe://)')
)
