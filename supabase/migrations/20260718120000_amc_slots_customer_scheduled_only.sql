-- AMC visit slots: only customer-scheduled visits keep a booking_id / OM reference.
-- Legacy auto-generated AMC bookings (on subscribe) are cancelled and slots reset to pending.

-- Mark bookings the customer scheduled via the app (has calendar slot metadata).
update public.bookings b
set metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object('customer_scheduled_amc', true)
where b.subscription_id is not null
  and b.metadata is not null
  and b.metadata ? 'schedule_slot'
  and coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false) is distinct from true;

-- Detach slots from provisional auto bookings (not yet accepted by a partner).
update public.subscription_visit_slots v
set
  booking_id = null,
  status = 'pending'
from public.bookings b
where v.booking_id = b.id
  and b.subscription_id is not null
  and b.status = 'confirmed'
  and coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false) is not true
  and not (b.metadata ? 'schedule_slot')
  and (
    coalesce(b.metadata ->> 'source', '') = 'subscription_amc'
    or coalesce(b.customer_notes, '') ilike '%Auto-scheduled%'
  );

-- Cancel provisional auto bookings so customers do not see phantom OM- IDs.
update public.bookings b
set
  status = 'cancelled',
  cancelled_at = coalesce(b.cancelled_at, now()),
  cancellation_reason = coalesce(
    nullif(trim(b.cancellation_reason), ''),
    'Legacy auto-scheduled AMC visit removed — schedule each visit from your AMC plan.'
  ),
  metadata = coalesce(b.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'legacy_auto_amc_cancelled', true,
      'cancelled_reason_code', 'legacy_auto_amc_reset'
    )
where b.subscription_id is not null
  and b.status = 'confirmed'
  and coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false) is not true
  and not (b.metadata ? 'schedule_slot')
  and (
    coalesce(b.metadata ->> 'source', '') = 'subscription_amc'
    or coalesce(b.customer_notes, '') ilike '%Auto-scheduled%'
  );

-- Link customer-scheduled AMC bookings to the matching visit slot (by sequence).
update public.subscription_visit_slots v
set
  booking_id = b.id,
  status = case
    when b.status = 'completed' then 'completed'
    when b.status = 'cancelled' then 'cancelled'
    else 'scheduled'
  end
from public.bookings b
where b.subscription_id = v.subscription_id
  and b.status <> 'cancelled'
  and v.booking_id is distinct from b.id
  and (
    coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false)
    or b.metadata ? 'schedule_slot'
  )
  and b.metadata is not null
  and (b.metadata ->> 'sequence') ~ '^[0-9]+$'
  and (b.metadata ->> 'sequence')::integer = v.sequence;

-- Pending slots must not reference a booking.
update public.subscription_visit_slots
set booking_id = null
where status = 'pending'
  and booking_id is not null;

-- Recount visits_used from slots that have a live booking link.
update public.subscriptions s
set visits_used = coalesce(sub.cnt, 0)
from (
  select
    v.subscription_id,
    count(*)::integer as cnt
  from public.subscription_visit_slots v
  join public.bookings b on b.id = v.booking_id
  where v.booking_id is not null
    and b.status <> 'cancelled'
    and (
      coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false)
      or b.metadata ? 'schedule_slot'
    )
  group by v.subscription_id
) sub
where s.id = sub.subscription_id;
