-- Technician activity timeline: discrete events (assignments, job started/finished, ratings, etc.).

create table if not exists public.technician_activity_events (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  kind text not null,
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  booking_id uuid references public.bookings (id) on delete set null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint technician_activity_events_dedupe unique (technician_id, dedupe_key)
);

create index if not exists technician_activity_events_tech_time_idx
  on public.technician_activity_events (technician_id, occurred_at desc);

create index if not exists technician_activity_events_booking_idx
  on public.technician_activity_events (booking_id)
  where booking_id is not null;

alter table public.technician_activity_events enable row level security;

drop policy if exists technician_activity_events_select_own on public.technician_activity_events;
create policy technician_activity_events_select_own
on public.technician_activity_events for select to authenticated
using (technician_id = public.my_technician_id());

grant select on public.technician_activity_events to authenticated;

create or replace function public.insert_technician_activity(
  p_technician_id uuid,
  p_kind text,
  p_title text,
  p_summary text,
  p_occurred_at timestamptz,
  p_booking_id uuid,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_technician_id is null then
    return;
  end if;

  insert into public.technician_activity_events (
    technician_id,
    kind,
    title,
    summary,
    occurred_at,
    booking_id,
    dedupe_key,
    payload
  )
  values (
    p_technician_id,
    p_kind,
    p_title,
    p_summary,
    coalesce(p_occurred_at, now()),
    p_booking_id,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (technician_id, dedupe_key) do nothing;
end;
$$;

create or replace function public.log_technician_activity_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  base_payload jsonb;
begin
  ref_code := coalesce(nullif(trim(both from new.reference_code), ''), new.id::text);
  base_payload := jsonb_build_object(
    'reference_code', ref_code,
    'status', new.status,
    'scheduled_start', new.scheduled_start
  );

  if tg_op = 'INSERT' then
    if new.technician_id is not null then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_assigned',
        'New job assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, new.created_at, now()),
        new.id,
        'booking:' || new.id::text || ':assigned:' || new.technician_id::text,
        base_payload
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.technician_id is not null and old.technician_id is distinct from new.technician_id then
      perform public.insert_technician_activity(
        old.technician_id,
        'job_unassigned',
        'Assignment removed',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':unassigned:' || old.technician_id::text,
        base_payload
      );
    end if;

    if new.technician_id is not null
      and (old.technician_id is null or old.technician_id is distinct from new.technician_id) then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_assigned',
        'New job assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':assigned:' || new.technician_id::text,
        base_payload
      );
    end if;

    if new.technician_id is not null and old.status is distinct from new.status then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_status_' || new.status,
        case new.status
          when 'accepted' then 'Job accepted'
          when 'in_progress' then 'Job started'
          when 'completed' then 'Job finished'
          when 'cancelled' then 'Job cancelled'
          when 'confirmed' then 'Visit confirmed'
          when 'pending_payment' then 'Awaiting payment'
          else 'Job updated'
        end,
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':status:' || new.status,
        base_payload || jsonb_build_object('previous_status', old.status)
      );
    end if;

    if new.technician_id is not null
      and old.scheduled_start is distinct from new.scheduled_start then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_rescheduled',
        'Visit rescheduled',
        to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY · HH12:MI AM'),
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':reschedule:' || new.scheduled_start::text,
        base_payload
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists technician_activity_booking_trg on public.bookings;
create trigger technician_activity_booking_trg
after insert or update on public.bookings
for each row execute function public.log_technician_activity_from_booking();

create or replace function public.log_technician_activity_from_job_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
begin
  if tg_op <> 'UPDATE' or new.technician_id is null then
    return new;
  end if;

  if old.customer_rating is not distinct from new.customer_rating or new.customer_rating is null then
    return new;
  end if;

  select coalesce(nullif(trim(both from b.reference_code), ''), new.booking_id::text)
  into ref_code
  from public.bookings b
  where b.id = new.booking_id;

  perform public.insert_technician_activity(
    new.technician_id,
    'customer_rating_received',
    'Customer rated visit',
    'Visit ' || coalesce(ref_code, '') || ' · ' || new.customer_rating::text || ' / 5',
    coalesce(new.updated_at, now()),
    new.booking_id,
    'job_report:' || new.id::text || ':rating:' || new.customer_rating::text,
    jsonb_build_object(
      'reference_code', ref_code,
      'customer_rating', new.customer_rating,
      'booking_id', new.booking_id
    )
  );

  return new;
end;
$$;

drop trigger if exists technician_activity_job_report_trg on public.job_reports;
create trigger technician_activity_job_report_trg
after update on public.job_reports
for each row execute function public.log_technician_activity_from_job_report();

-- Backfill recent assignment + status milestones (idempotent).
insert into public.technician_activity_events (
  technician_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  dedupe_key,
  payload
)
select
  b.technician_id,
  'job_assigned',
  'New job assigned',
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  coalesce(b.updated_at, b.created_at),
  b.id,
  'booking:' || b.id::text || ':assigned:' || b.technician_id::text,
  jsonb_build_object(
    'reference_code', b.reference_code,
    'status', b.status,
    'scheduled_start', b.scheduled_start
  )
from public.bookings b
where b.technician_id is not null
on conflict (technician_id, dedupe_key) do nothing;

insert into public.technician_activity_events (
  technician_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  dedupe_key,
  payload
)
select
  b.technician_id,
  'job_status_' || b.status,
  case b.status
    when 'accepted' then 'Job accepted'
    when 'in_progress' then 'Job started'
    when 'completed' then 'Job finished'
    when 'cancelled' then 'Job cancelled'
    when 'confirmed' then 'Visit confirmed'
    else 'Job updated'
  end,
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  coalesce(b.updated_at, b.created_at),
  b.id,
  'booking:' || b.id::text || ':status:' || b.status,
  jsonb_build_object(
    'reference_code', b.reference_code,
    'status', b.status,
    'scheduled_start', b.scheduled_start
  )
from public.bookings b
where b.technician_id is not null
  and b.status in ('accepted', 'in_progress', 'completed', 'cancelled', 'confirmed')
on conflict (technician_id, dedupe_key) do nothing;

insert into public.technician_activity_events (
  technician_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  dedupe_key,
  payload
)
select
  jr.technician_id,
  'customer_rating_received',
  'Customer rated visit',
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), jr.booking_id::text)
    || ' · ' || jr.customer_rating::text || ' / 5',
  coalesce(jr.updated_at, jr.created_at),
  jr.booking_id,
  'job_report:' || jr.id::text || ':rating:' || jr.customer_rating::text,
  jsonb_build_object(
    'reference_code', b.reference_code,
    'customer_rating', jr.customer_rating,
    'booking_id', jr.booking_id
  )
from public.job_reports jr
join public.bookings b on b.id = jr.booking_id
where jr.technician_id is not null
  and jr.customer_rating is not null
on conflict (technician_id, dedupe_key) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'technician_activity_events'
  ) then
    alter publication supabase_realtime add table public.technician_activity_events;
  end if;
end $$;
