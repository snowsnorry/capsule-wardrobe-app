create table if not exists job_events (
  id bigserial primary key,
  job_id uuid not null references job_runs(id) on delete cascade,
  event_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
)
