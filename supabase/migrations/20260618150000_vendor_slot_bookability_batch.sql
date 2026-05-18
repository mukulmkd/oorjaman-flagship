-- Batch slot bookability for customer booking UI and consistent checks across roles.
-- SECURITY DEFINER reads vendor_slot_availability + bookings without widening RLS on those tables.

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
      and coalesce(bcx.cnt, 0) < greatest(1, coalesce(vsa.capacity, 1)::int)
    ) as bookable
  from unnest(coalesce(p_slot_ids, array[]::text[])) as u(slot_id)
  left join public.vendor_slot_availability vsa
    on vsa.vendor_id = p_vendor_id
   and vsa.day_key = p_day_key::date
   and vsa.slot_id = u.slot_id
  left join lateral (
    select count(*)::int as cnt
    from public.bookings b
    where b.vendor_id = p_vendor_id
      and b.status in (
        'confirmed'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status
      )
      and b.metadata @> jsonb_build_object(
        'schedule_slot',
        jsonb_build_object('day_key', p_day_key, 'slot_id', u.slot_id)
      )
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  ) bcx on true;
$$;

revoke all on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) from public;
grant execute on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) to authenticated;
grant execute on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) to service_role;
