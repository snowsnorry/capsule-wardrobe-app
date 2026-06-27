create unique index if not exists job_runs_active_dedupe_idx on job_runs (profile_email, kind, dedupe_key) where dedupe_key is not null and status in ('queued', 'running')
