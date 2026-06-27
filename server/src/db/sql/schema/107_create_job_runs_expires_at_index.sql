create index if not exists job_runs_expires_at_idx on job_runs (expires_at) where expires_at is not null
