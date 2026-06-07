create index if not exists outfits_email_updated_at_idx
on outfits (email, updated_at desc)
