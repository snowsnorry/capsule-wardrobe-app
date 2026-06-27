create index if not exists job_runs_entity_status_idx on job_runs (profile_email, entity_type, entity_id, status)
