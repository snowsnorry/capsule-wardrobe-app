create table if not exists profiles (
  email text primary key,
  active_capsule_id uuid null,
  locale text not null,
  fullname text null,
  theme text not null default 'system'
    constraint profiles_theme_check
    check (theme in ('system', 'light', 'dark')),
  llm text not null default 'openai:gpt-5.5'
    constraint profiles_llm_check
    check (
      llm = 'none'
      or llm ~ '^(openai|claude|gemini|deepinfra):'
    ),
  image_llm text not null default 'openai:gpt-image-2'
    constraint profiles_image_llm_check
    check (image_llm ~ '^(openai|gemini):'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
