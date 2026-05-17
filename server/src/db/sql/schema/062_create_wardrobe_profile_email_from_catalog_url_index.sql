create unique index if not exists wardrobe_profile_email_from_catalog_url_idx
on wardrobe (profile_email, url)
where source = 'from_catalog' and url is not null
