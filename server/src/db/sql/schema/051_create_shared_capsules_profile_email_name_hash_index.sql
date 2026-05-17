create unique index if not exists shared_capsules_profile_email_name_hash_idx
on shared_capsules (profile_email, name, content_hash)
