-- Per-address customer activity timeline (bookings, AMC, visit milestones).

create table if not exists public.customer_site_activity_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_address_id text not null,
  kind text not null,
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  booking_id uuid references public.bookings (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint customer_site_activity_events_dedupe unique (customer_id, dedupe_key)
);

create index if not exists customer_site_activity_events_address_time_idx
  on public.customer_site_activity_events (customer_id, service_address_id, occurred_at desc);

create index if not exists customer_site_activity_events_booking_idx
  on public.customer_site_activity_events (booking_id)
  where booking_id is not null;

alter table public.customer_site_activity_events enable row level security;

drop policy if exists customer_site_activity_events_select_own on public.customer_site_activity_events;
create policy customer_site_activity_events_select_own
on public.customer_site_activity_events for select to authenticated
using (customer_id = public.my_customer_id());

drop policy if exists customer_site_activity_events_insert_own on public.customer_site_activity_events;
create policy customer_site_activity_events_insert_own
on public.customer_site_activity_events for insert to authenticated
with check (customer_id = public.my_customer_id());

grant select, insert on public.customer_site_activity_events to authenticated;

create or replace function public.booking_metadata_service_address_id(meta jsonb)
returns text
language sql
immutable
as $$
  select nullif(trim(both from meta->>'service_address_id'), '');
$$;

create or replace function public.subscription_service_address_id(sub public.subscriptions)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both from sub.service_address_id), ''),
    public.booking_metadata_service_address_id(sub.metadata)
  );
$$;

create or replace function public.insert_customer_site_activity(
  p_customer_id uuid,
  p_service_address_id text,
  p_kind text,
  p_title text,
  p_summary text,
  p_occurred_at timestamptz,
  p_booking_id uuid,
  p_subscription_id uuid,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_service_address_id is null or length(trim(p_service_address_id)) = 0 then
    return;
  end if;

  insert into public.customer_site_activity_events (
    customer_id,
    service_address_id,
    kind,
    title,
    summary,
    occurred_at,
    booking_id,
    subscription_id,
    dedupe_key,
    payload
  )
  values (
    p_customer_id,
    trim(p_service_address_id),
    p_kind,
    p_title,
    p_summary,
    coalesce(p_occurred_at, now()),
    p_booking_id,
    p_subscription_id,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (customer_id, dedupe_key) do nothing;
end;
$$;

create or replace function public.log_customer_site_activity_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr_id text;
  ref_code text;
  base_payload jsonb;
begin
  addr_id := public.booking_metadata_service_address_id(new.metadata);
  if addr_id is null then
    return new;
  end if;

  ref_code := coalesce(nullif(trim(both from new.reference_code), ''), new.id::text);
  base_payload := jsonb_build_object(
    'reference_code', ref_code,
    'status', new.status,
    'scheduled_start', new.scheduled_start
  );

  if tg_op = 'INSERT' then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'booking_created',
      'Booking placed',
      'Visit ' || ref_code || ' · ' || to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY'),
      coalesce(new.created_at, now()),
      new.id,
      new.subscription_id,
      'booking:' || new.id::text || ':created',
      base_payload
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_status_' || new.status,
        case new.status
          when 'pending_payment' then 'Awaiting payment'
          when 'confirmed' then 'Booking confirmed'
          when 'accepted' then 'Vendor accepted'
          when 'in_progress' then 'Technician on the way'
          when 'completed' then 'Visit completed'
          when 'cancelled' then 'Booking cancelled'
          else 'Booking updated'
        end,
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':status:' || new.status,
        base_payload || jsonb_build_object('previous_status', old.status)
      );
    end if;

    if old.technician_id is null and new.technician_id is not null then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_technician_assigned',
        'Technician assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':technician_assigned',
        base_payload || jsonb_build_object('technician_id', new.technician_id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_site_activity_booking_trg on public.bookings;
create trigger customer_site_activity_booking_trg
after insert or update on public.bookings
for each row execute function public.log_customer_site_activity_from_booking();

create or replace function public.log_customer_site_activity_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr_id text;
begin
  addr_id := public.subscription_service_address_id(new);
  if addr_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'amc_subscribed',
      'AMC plan started',
      coalesce(new.plan_name, new.plan_code) || ' · valid through ' ||
        to_char(new.ends_at at time zone 'Asia/Kolkata', 'Mon DD, YYYY'),
      coalesce(new.starts_at, new.created_at, now()),
      null,
      new.id,
      'subscription:' || new.id::text || ':created',
      jsonb_build_object(
        'plan_code', new.plan_code,
        'plan_name', new.plan_name,
        'visits_included', new.visits_included
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and old.plan_code is distinct from new.plan_code then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'amc_upgraded',
      'AMC plan upgraded',
      coalesce(new.plan_name, new.plan_code) ||
        coalesce(' (was ' || old.plan_name || ')', ''),
      coalesce(new.updated_at, now()),
      null,
      new.id,
      'subscription:' || new.id::text || ':plan:' || new.plan_code,
      jsonb_build_object(
        'plan_code', new.plan_code,
        'previous_plan_code', old.plan_code
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists customer_site_activity_subscription_trg on public.subscriptions;
create trigger customer_site_activity_subscription_trg
after insert or update on public.subscriptions
for each row execute function public.log_customer_site_activity_from_subscription();

create or replace function public.log_customer_site_activity_from_visit_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.subscriptions;
  addr_id text;
  ref_code text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.booking_id is not null or new.booking_id is null then
    return new;
  end if;

  select * into sub from public.subscriptions s where s.id = new.subscription_id;
  if not found then
    return new;
  end if;

  addr_id := public.subscription_service_address_id(sub);
  if addr_id is null then
    return new;
  end if;

  select coalesce(nullif(trim(both from b.reference_code), ''), new.booking_id::text)
  into ref_code
  from public.bookings b
  where b.id = new.booking_id;

  perform public.insert_customer_site_activity(
    sub.customer_id,
    addr_id,
    'amc_visit_scheduled',
    'AMC visit scheduled',
    'Visit ' || coalesce(ref_code, '') || ' · slot ' || new.sequence::text,
    coalesce(new.updated_at, now()),
    new.booking_id,
    new.subscription_id,
    'visit_slot:' || new.id::text || ':scheduled',
    jsonb_build_object('sequence', new.sequence, 'reference_code', ref_code)
  );

  return new;
end;
$$;

drop trigger if exists customer_site_activity_visit_slot_trg on public.subscription_visit_slots;
create trigger customer_site_activity_visit_slot_trg
after update on public.subscription_visit_slots
for each row execute function public.log_customer_site_activity_from_visit_slot();

-- Backfill recent history for existing customers (idempotent via dedupe_key).
insert into public.customer_site_activity_events (
  customer_id,
  service_address_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  subscription_id,
  dedupe_key,
  payload
)
select
  b.customer_id,
  public.booking_metadata_service_address_id(b.metadata),
  'booking_created',
  'Booking placed',
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  b.created_at,
  b.id,
  b.subscription_id,
  'booking:' || b.id::text || ':created',
  jsonb_build_object('reference_code', b.reference_code, 'status', b.status)
from public.bookings b
where public.booking_metadata_service_address_id(b.metadata) is not null
on conflict (customer_id, dedupe_key) do nothing;

insert into public.customer_site_activity_events (
  customer_id,
  service_address_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  subscription_id,
  dedupe_key,
  payload
)
select
  s.customer_id,
  public.subscription_service_address_id(s),
  'amc_subscribed',
  'AMC plan started',
  coalesce(s.plan_name, s.plan_code),
  coalesce(s.starts_at, s.created_at),
  null,
  s.id,
  'subscription:' || s.id::text || ':created',
  jsonb_build_object('plan_code', s.plan_code, 'plan_name', s.plan_name)
from public.subscriptions s
where public.subscription_service_address_id(s) is not null
on conflict (customer_id, dedupe_key) do nothing;

insert into public.customer_site_activity_events (
  customer_id,
  service_address_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  subscription_id,
  dedupe_key,
  payload
)
select
  b.customer_id,
  public.booking_metadata_service_address_id(b.metadata),
  'booking_status_' || b.status,
  case b.status
    when 'pending_payment' then 'Awaiting payment'
    when 'confirmed' then 'Booking confirmed'
    when 'accepted' then 'Vendor accepted'
    when 'in_progress' then 'Technician on the way'
    when 'completed' then 'Visit completed'
    when 'cancelled' then 'Booking cancelled'
    else 'Booking updated'
  end,
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  coalesce(b.updated_at, b.created_at),
  b.id,
  b.subscription_id,
  'booking:' || b.id::text || ':status:' || b.status,
  jsonb_build_object('reference_code', b.reference_code, 'status', b.status)
from public.bookings b
where public.booking_metadata_service_address_id(b.metadata) is not null
  and b.status <> 'pending_payment'
on conflict (customer_id, dedupe_key) do nothing;

-- Realtime feed refresh on the Activity tab.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_site_activity_events'
  ) then
    alter publication supabase_realtime add table public.customer_site_activity_events;
  end if;
end $$;
