alter table search
add column if not exists exact_color_range text not null default 'balanced'
check (exact_color_range in ('closest', 'close', 'balanced', 'broad', 'broadest'))
