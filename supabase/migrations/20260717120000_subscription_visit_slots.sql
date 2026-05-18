-- AMC visit placeholders: ideal dates on subscribe; real bookings created when customer schedules.

create table if not exists public.subscription_visit_slots (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  ideal_scheduled_start timestamptz not null,
  ideal_scheduled_end timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'completed', 'cancelled')),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, sequence)
);

create index if not exists subscription_visit_slots_subscription_id_idx
  on public.subscription_visit_slots (subscription_id);

create index if not exists subscription_visit_slots_booking_id_idx
  on public.subscription_visit_slots (booking_id)
  where booking_id is not null;

create or replace function public.touch_subscription_visit_slots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscription_visit_slots_updated_at on public.subscription_visit_slots;
create trigger subscription_visit_slots_updated_at
before update on public.subscription_visit_slots
for each row execute function public.touch_subscription_visit_slots_updated_at();

alter table public.subscription_visit_slots enable row level security;

drop policy if exists subscription_visit_slots_select on public.subscription_visit_slots;
create policy subscription_visit_slots_select
on public.subscription_visit_slots for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.subscriptions s
      join public.bookings b on b.customer_id = s.customer_id
      where s.id = subscription_visit_slots.subscription_id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
);

drop policy if exists subscription_visit_slots_insert_own on public.subscription_visit_slots;
create policy subscription_visit_slots_insert_own
on public.subscription_visit_slots for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
);

drop policy if exists subscription_visit_slots_update_own on public.subscription_visit_slots;
create policy subscription_visit_slots_update_own
on public.subscription_visit_slots for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
);

-- Backfill ideal slots for existing subscriptions (no duplicate rows).
insert into public.subscription_visit_slots (
  subscription_id,
  sequence,
  ideal_scheduled_start,
  ideal_scheduled_end,
  status
)
select
  s.id,
  gs.seq,
  s.starts_at + (gs.seq - 1) * (
    greatest(
      extract(epoch from (s.ends_at - s.starts_at)) / greatest(coalesce(s.visits_included, 1), 1),
      86400
    ) * interval '1 second'
  ),
  least(
    s.starts_at
      + (gs.seq - 1) * (
        greatest(
          extract(epoch from (s.ends_at - s.starts_at)) / greatest(coalesce(s.visits_included, 1), 1),
          86400
        ) * interval '1 second'
      )
      + interval '2 hours',
    s.ends_at
  ),
  'pending'
from public.subscriptions s
cross join lateral generate_series(1, greatest(coalesce(s.visits_included, 0), 0)) as gs(seq)
where coalesce(s.visits_included, 0) > 0
  and not exists (
    select 1
    from public.subscription_visit_slots v
    where v.subscription_id = s.id
  )
  and s.starts_at + (gs.seq - 1) * (
    greatest(
      extract(epoch from (s.ends_at - s.starts_at)) / greatest(coalesce(s.visits_included, 1), 1),
      86400
    ) * interval '1 second'
  ) < s.ends_at;

-- Link existing AMC bookings by metadata.sequence when present.
update public.subscription_visit_slots v
set
  booking_id = b.id,
  status = case
    when b.status in ('completed') then 'completed'
    when b.status = 'cancelled' then 'cancelled'
    else 'scheduled'
  end
from public.bookings b
where b.subscription_id = v.subscription_id
  and b.status <> 'cancelled'
  and v.booking_id is null
  and v.status = 'pending'
  and b.metadata is not null
  and (b.metadata ->> 'source') = 'subscription_amc'
  and (b.metadata ->> 'sequence') ~ '^[0-9]+$'
  and (b.metadata ->> 'sequence')::integer = v.sequence;

-- Fallback: match non-cancelled subscription bookings to slots by visit order.
with ranked_bookings as (
  select
    b.id,
    b.subscription_id,
    b.status,
    row_number() over (
      partition by b.subscription_id
      order by b.scheduled_start asc, b.created_at asc
    ) as rn
  from public.bookings b
  where b.subscription_id is not null
    and b.status <> 'cancelled'
)
update public.subscription_visit_slots v
set
  booking_id = rb.id,
  status = case
    when rb.status in ('completed') then 'completed'
    else 'scheduled'
  end
from ranked_bookings rb
where rb.subscription_id = v.subscription_id
  and rb.rn = v.sequence
  and v.booking_id is null
  and v.status = 'pending';

-- Align visit counters with linked slots.
update public.subscriptions s
set visits_used = sub.cnt
from (
  select subscription_id, count(*)::integer as cnt
  from public.subscription_visit_slots
  where status in ('scheduled', 'completed')
  group by subscription_id
) sub
where s.id = sub.subscription_id
  and s.visits_used < sub.cnt;
