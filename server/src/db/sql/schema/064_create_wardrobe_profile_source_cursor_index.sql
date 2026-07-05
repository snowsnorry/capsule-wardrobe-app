create index if not exists wardrobe_profile_source_cursor_idx
on wardrobe (
  profile_email,
  source,
  updated_at desc,
  created_at desc,
  id desc
)
