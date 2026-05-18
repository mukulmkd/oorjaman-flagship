do $enum$
begin
  create type public.vendor_technician_invite_status as enum (
    'invited',
    'opened',
    'completed',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $enum$;

create table if not exists public.vendor_technician_invites (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  invited_by_user_id uuid not null references public.users (id) on delete cascade,
  full_name text,
  invite_phone_e164 text not null,
  invite_email text,
  invite_token text not null unique,
  invite_url text,
  status public.vendor_technician_invite_status not null default 'invited',
  notification_channels text[] not null default '{}'::text[],
  invited_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,
  last_notified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_technician_invites_vendor_id_idx
  on public.vendor_technician_invites (vendor_id);

create index if not exists vendor_technician_invites_phone_idx
  on public.vendor_technician_invites (invite_phone_e164);

drop trigger if exists vendor_technician_invites_set_updated_at on public.vendor_technician_invites;
create trigger vendor_technician_invites_set_updated_at
before update on public.vendor_technician_invites
for each row execute function public.set_updated_at();

alter table public.technicians
  add column if not exists vendor_review_status text not null default 'pending';

alter table public.technicians
  add column if not exists vendor_reviewed_at timestamptz;

alter table public.technicians
  add column if not exists vendor_rejection_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'technicians_vendor_review_status_chk'
  ) then
    alter table public.technicians
      add constraint technicians_vendor_review_status_chk
      check (vendor_review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;
