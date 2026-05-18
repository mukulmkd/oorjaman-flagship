alter table public.job_reports
  add column if not exists feedback_hidden boolean not null default false;

alter table public.job_reports
  add column if not exists feedback_hidden_reason text;

alter table public.job_reports
  add column if not exists feedback_hidden_at timestamptz;

alter table public.job_reports
  add column if not exists feedback_hidden_by uuid references public.users (id) on delete set null;

create index if not exists job_reports_feedback_hidden_idx
  on public.job_reports (feedback_hidden, completed_at desc);
