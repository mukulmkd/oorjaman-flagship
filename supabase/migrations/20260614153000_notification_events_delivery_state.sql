-- Delivery state columns for demo-mode notification processing.

alter table public.notification_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists demo_mode boolean not null default true;

create index if not exists notification_events_retry_idx
  on public.notification_events (status, next_attempt_at, created_at);
