-- Per schedule slot: max 5 *raised* bookings (not only accepted).
-- Raised = pending_payment | confirmed | vendor_acknowledged | accepted | in_progress.
-- Cancelled / completed do not count, so cancels and non-accepts free capacity for new bookings.
-- Count is platform-wide for day_key + slot_id (any vendor or unassigned marketplace).

alter table public.vendor_slot_availability
  alter column capacity set default 5;

comment on column public.vendor_slot_availability.capacity is
  'Optional vendor hint; platform raised-booking cap for a schedule slot is 5.';

create or replace function public.vendor_slot_bookability_batch(
  p_vendor_id uuid,
  p_day_key text,
  p_slot_ids text[],
  p_exclude_booking_id uuid default null
)
returns table (slot_id text, bookable boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.slot_id,
    (
      coalesce(vsa.is_available, true)
      and coalesce(raised.cnt, 0) < 5
    ) as bookable
  from unnest(coalesce(p_slot_ids, array[]::text[])) as u(slot_id)
  left join public.vendor_slot_availability vsa
    on vsa.vendor_id = p_vendor_id
   and vsa.day_key = p_day_key::date
   and vsa.slot_id = u.slot_id
  left join lateral (
    select count(*)::int as cnt
    from public.bookings b
    where b.status in (
        'pending_payment'::public.booking_status,
        'confirmed'::public.booking_status,
        'vendor_acknowledged'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status
      )
      and b.metadata @> jsonb_build_object(
        'schedule_slot',
        jsonb_build_object('day_key', p_day_key, 'slot_id', u.slot_id)
      )
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  ) raised on true;
$$;

revoke all on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) from public;
grant execute on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) to authenticated;
grant execute on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) to service_role;

-- Platform-only check (no vendor availability row). Used for "any partner" booking UI.
create or replace function public.schedule_slot_raised_bookability_batch(
  p_day_key text,
  p_slot_ids text[],
  p_exclude_booking_id uuid default null
)
returns table (slot_id text, bookable boolean, raised_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.slot_id,
    (coalesce(raised.cnt, 0) < 5) as bookable,
    coalesce(raised.cnt, 0)::int as raised_count
  from unnest(coalesce(p_slot_ids, array[]::text[])) as u(slot_id)
  left join lateral (
    select count(*)::int as cnt
    from public.bookings b
    where b.status in (
        'pending_payment'::public.booking_status,
        'confirmed'::public.booking_status,
        'vendor_acknowledged'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status
      )
      and b.metadata @> jsonb_build_object(
        'schedule_slot',
        jsonb_build_object('day_key', p_day_key, 'slot_id', u.slot_id)
      )
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  ) raised on true;
$$;

revoke all on function public.schedule_slot_raised_bookability_batch(text, text[], uuid) from public;
grant execute on function public.schedule_slot_raised_bookability_batch(text, text[], uuid) to authenticated;
grant execute on function public.schedule_slot_raised_bookability_batch(text, text[], uuid) to service_role;
