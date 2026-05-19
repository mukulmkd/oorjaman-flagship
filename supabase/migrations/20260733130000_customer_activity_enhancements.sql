-- Customer activity: rescheduled visits and customer ratings on completed jobs.

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

    if old.scheduled_start is distinct from new.scheduled_start then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_rescheduled',
        'Visit rescheduled',
        to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY · HH12:MI AM'),
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':reschedule:' || new.scheduled_start::text,
        base_payload
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.log_customer_site_activity_from_job_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  addr_id text;
  ref_code text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.customer_rating is not distinct from new.customer_rating or new.customer_rating is null then
    return new;
  end if;

  select * into b from public.bookings where id = new.booking_id;
  if not found then
    return new;
  end if;

  addr_id := public.booking_metadata_service_address_id(b.metadata);
  if addr_id is null then
    return new;
  end if;

  ref_code := coalesce(nullif(trim(both from b.reference_code), ''), b.id::text);

  perform public.insert_customer_site_activity(
    b.customer_id,
    addr_id,
    'customer_rating_submitted',
    'You rated this visit',
    ref_code || ' · ' || new.customer_rating::text || ' / 5',
    coalesce(new.updated_at, now()),
    b.id,
    b.subscription_id,
    'job_report:' || new.id::text || ':rating:' || new.customer_rating::text,
    jsonb_build_object(
      'reference_code', ref_code,
      'customer_rating', new.customer_rating,
      'booking_id', b.id
    )
  );

  return new;
end;
$$;

drop trigger if exists customer_site_activity_job_report_trg on public.job_reports;
create trigger customer_site_activity_job_report_trg
after update on public.job_reports
for each row execute function public.log_customer_site_activity_from_job_report();
