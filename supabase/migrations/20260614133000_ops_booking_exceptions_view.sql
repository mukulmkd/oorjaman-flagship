-- Server-side operations exception view for admin control dashboards.
-- Keeps risk detection rules centralized in SQL for consistent behavior.

drop view if exists public.ops_booking_exceptions;

create view public.ops_booking_exceptions
with (security_invoker = true) as
select
  b.id as booking_id,
  b.reference_code,
  b.status,
  b.vendor_id,
  b.technician_id,
  b.scheduled_start,
  b.scheduled_end,
  b.created_at,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'default_vendor_unclaimed'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
      then 'vendor_slow_confirmation'
    when b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
      then 'visit_not_started'
    when b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
      then 'visit_not_closed'
    when b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
      then 'schedule_missed'
    else null
  end as issue_type,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
      then 'medium'
    when b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
      then 'high'
    when b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
      then 'medium'
    when b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
      then 'high'
    else null
  end as issue_level,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'Default-vendor window expired without claim'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
      then 'Vendor has not progressed booking after confirmation'
    when b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
      then 'Visit not started 2h after scheduled start'
    when b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
      then 'Visit not closed 2h after scheduled end'
    when b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
      then 'Scheduled window started without movement'
    else null
  end as issue_label
from public.bookings b
where b.status in (
  'confirmed'::public.booking_status,
  'accepted'::public.booking_status,
  'in_progress'::public.booking_status
)
  and (
    (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
    )
    or (
      b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
    )
    or (
      b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
    )
  );

comment on view public.ops_booking_exceptions is
  'Operational exception queue for bookings requiring admin intervention.';

grant select on public.ops_booking_exceptions to authenticated;
