create index if not exists capsules_email_lower_name_idx
on capsules (email, lower(name))
