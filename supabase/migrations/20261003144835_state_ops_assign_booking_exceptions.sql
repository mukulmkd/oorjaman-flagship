-- Marketplace float is closed. Unassigned confirmed visits wait for state operations
-- immediately (no 1-hour claim window, no 2-hour float delay).

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
      and (
        (b.metadata #>> '{marketplace,mode}') = 'state_ops_assign'
        or (b.metadata #>> '{marketplace,awaiting_state_ops_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
        or (b.metadata #>> '{vendor_reassignment,awaiting_admin_assignment}') = 'true'
      )
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
      and (
        (b.metadata #>> '{marketplace,mode}') = 'state_ops_assign'
        or (b.metadata #>> '{marketplace,awaiting_state_ops_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
        or (b.metadata #>> '{vendor_reassignment,awaiting_admin_assignment}') = 'true'
      )
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
      and (
        (b.metadata #>> '{marketplace,mode}') = 'state_ops_assign'
        or (b.metadata #>> '{marketplace,awaiting_state_ops_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
        or (b.metadata #>> '{vendor_reassignment,awaiting_admin_assignment}') = 'true'
      )
      then 'Assign a partner. This visit is not offered to the partner network.'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'Partner needed — assign from Bookings'
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
      and (
        (b.metadata #>> '{marketplace,mode}') = 'state_ops_assign'
        or (b.metadata #>> '{marketplace,awaiting_state_ops_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_assignment}') = 'true'
        or (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
        or (b.metadata #>> '{vendor_reassignment,awaiting_admin_assignment}') = 'true'
      )
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
  'Operational exception queue: unassigned visits for state operations, partner response window, visit timing.';

grant select on public.ops_booking_exceptions to authenticated;

create or replace function public.notify_overdue_vendor_responses_batch(p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_deadline timestamptz;
  v_now timestamptz := now();
  v_notified int := 0;
  v_scanned int := 0;
  v_vendor_name text;
  v_ref text;
  v_title text;
  v_body text;
  v_payload jsonb;
  v_limit int;
begin
  v_limit := greatest(1, least(coalesce(p_limit, 200), 500));

  for rec in
    select b.*
    from public.bookings b
    where b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
    order by b.scheduled_start asc
    limit v_limit
  loop
    v_scanned := v_scanned + 1;

    if nullif(trim(rec.metadata #>> '{ops,vendor_response_overdue_at}'), '') is not null then
      continue;
    end if;

    if (rec.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      or (rec.metadata #>> '{marketplace,awaiting_state_ops_assignment}') = 'true' then
      continue;
    end if;

    v_deadline :=
      coalesce(
        nullif(trim(rec.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
        nullif(trim(rec.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
        rec.created_at
      ) + interval '1 hour';

    if v_now <= v_deadline then
      continue;
    end if;

    select v.business_name
    into v_vendor_name
    from public.vendors v
    where v.id = rec.vendor_id;

    v_ref := coalesce(nullif(trim(rec.reference_code), ''), upper(left(rec.id::text, 8)));
    v_title := 'Partner response overdue';
    v_body :=
      coalesce(nullif(trim(v_vendor_name), ''), 'Assigned partner')
      || ' has not accepted or assigned a technician for '
      || v_ref
      || ' within the 1-hour window. Reassign the partner from Bookings, or contact them.';

    v_payload := jsonb_build_object(
      'reference_code', rec.reference_code,
      'booking_id', rec.id,
      'title', v_title,
      'body', v_body,
      'href', '/dashboard/bookings?highlight=' || rec.id::text,
      'vendor_id', rec.vendor_id,
      'vendor_name', v_vendor_name,
      'technician_id', null,
      'technician_name', null,
      'status', rec.status::text,
      'emitted_at', to_jsonb(v_now),
      'note', 'Partner response window expired (scheduled scan).'
    );

    insert into public.notification_events (
      booking_id,
      recipient_audience,
      recipient_vendor_id,
      event_type,
      channels,
      status,
      processed_at,
      payload
    )
    values (
      rec.id,
      'admin',
      null,
      'admin_booking_vendor_response_overdue',
      jsonb_build_array('in_app'),
      'sent',
      v_now,
      v_payload
    );

    update public.bookings
    set metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{ops}',
      coalesce(metadata -> 'ops', '{}'::jsonb)
        || jsonb_build_object('vendor_response_overdue_at', to_jsonb(v_now::text)),
      true
    )
    where id = rec.id;

    v_notified := v_notified + 1;
  end loop;

  return jsonb_build_object('scanned', v_scanned, 'notified', v_notified, 'ran_at', v_now);
end;
$$;

revoke all on function public.notify_overdue_vendor_responses_batch(int) from public, anon, authenticated;
grant execute on function public.notify_overdue_vendor_responses_batch(int) to service_role;
