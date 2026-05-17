create table if not exists wardrobe (
  id bigserial primary key,
  profile_email text not null references profiles(email) on delete cascade,
  product_id text null,
  name text null,
  url text null,
  description text null,
  brand text null,
  price double precision null,
  currency text null,
  availability text null,
  image_url text null,
  audience text null,
  category text null,
  season text[] not null default '{}'::text[],
  formality_level text[] not null default '{}'::text[],
  style text[] not null default '{}'::text[],
  occasions text[] not null default '{}'::text[],
  color_base text[] not null default '{}'::text[],
  pattern text null,
  finish text null,
  is_neutral boolean null,
  composition text null,
  silhouette text null,
  fit text null,
  closure_type text[] not null default '{}'::text[],
  embedding vector null,
  source text not null check (source in ('uploaded', 'from_catalog')),
  raw_image_url text
    constraint user_wardrobe_items_raw_image_url_http_check
    check (raw_image_url is null or raw_image_url ~* '^https?://'),
  processing_status text not null default 'ready'
    check (processing_status in (
      'uploaded',
      'image_processing',
      'metadata_processed',
      'needs_review',
      'ready',
      'failed'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_url_scheme_check
    check (url is null or url ~* '^(https?://|wardrobe://)'),
  constraint wardrobe_from_catalog_url_required_check
    check (source <> 'from_catalog' or nullif(trim(url), '') is not null)
)
