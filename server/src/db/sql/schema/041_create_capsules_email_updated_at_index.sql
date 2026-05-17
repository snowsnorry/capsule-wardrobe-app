create index if not exists capsules_email_updated_at_idx
on capsules (email, updated_at desc)
