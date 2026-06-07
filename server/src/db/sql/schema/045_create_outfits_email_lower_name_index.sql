create index if not exists outfits_email_lower_name_idx
on outfits (email, lower(name))
