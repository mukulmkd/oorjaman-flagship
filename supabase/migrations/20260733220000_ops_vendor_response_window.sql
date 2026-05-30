-- Align ops exceptions with 1h partner response window (vendor_response.anchor_at / marketplace.open_at / created_at).
-- Surface preferred-partner no-response separately for admin escalation.

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
  (
    coalesce(
      nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
      nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
      b.created_at
    )
  ) as vendor_response_anchor_at,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
      then 'awaiting_admin_float'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'default_vendor_unclaimed'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      and (b.metadata #>> '{vendor_routing,reason}') = 'preferred_ok'
      then 'preferred_vendor_no_response'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
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
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      and (b.metadata #>> '{vendor_routing,reason}') = 'preferred_ok'
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
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
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
      then 'Any-partner booking waiting for ops to float marketplace'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'Default-vendor window expired without claim'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      and (b.metadata #>> '{vendor_routing,reason}') = 'preferred_ok'
      then 'Preferred partner did not accept or assign within 1 hour'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      then 'Partner has not accepted or assigned technician within 1 hour'
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
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
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
  'Operational exception queue: marketplace float, partner response window, visit timing.';

grant select on public.ops_booking_exceptions to authenticated;

insert into public.notification_templates (event_type, channel, template_key, subject, body)
values
  (
    'admin_booking_created',
    'in_app',
    'default',
    'New booking',
    'A booking was confirmed and is visible in admin Bookings.'
  ),
  (
    'admin_booking_vendor_response_overdue',
    'in_app',
    'default',
    'Partner response overdue',
    'Assigned partner missed the 1-hour accept/assign window.'
  )
on conflict (event_type, channel, template_key) do update
set
  subject = excluded.subject,
  body = excluded.body;

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('admin_booking_created', 'in_app', true, true),
  ('admin_booking_vendor_response_overdue', 'in_app', true, true)
on conflict (event_type, channel) do nothing;
