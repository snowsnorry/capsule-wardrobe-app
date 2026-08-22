alter table search
add column if not exists exact_color text null
check (exact_color is null or exact_color ~ '^#[0-9a-f]{6}$')
