-- Automatic admin alerts when a direct-assigned partner misses the 1-hour accept/assign window.
-- In-app rows use notification_events → Supabase Realtime (admin bell updates live).

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

    if (rec.metadata #>> '{marketplace,awaiting_admin_float}') = 'true' then
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
      || ' within the 1-hour window. Reassign, float to marketplace, or contact the partner from Operations.';

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

comment on function public.notify_overdue_vendor_responses_batch(int) is
  'Inserts admin in-app notification_events for partners who missed the 1h response window. Idempotent per booking.';

revoke all on function public.notify_overdue_vendor_responses_batch(int) from public;
grant execute on function public.notify_overdue_vendor_responses_batch(int) to service_role;

-- pg_cron: every 5 minutes (enable pg_cron in Supabase Dashboard if schedule fails locally).
create extension if not exists pg_cron with schema pg_catalog;

do $cron$
declare
  job_id bigint;
begin
  for job_id in
    select jobid from cron.job where jobname = 'notify-overdue-vendor-responses'
  loop
    perform cron.unschedule(job_id);
  end loop;

  perform cron.schedule(
    'notify-overdue-vendor-responses',
    '*/5 * * * *',
    $cmd$select public.notify_overdue_vendor_responses_batch(200);$cmd$
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped (enable pg_cron on hosted project or use Dashboard cron → scan-vendor-response-overdue edge function): %', sqlerrm;
end;
$cron$;
