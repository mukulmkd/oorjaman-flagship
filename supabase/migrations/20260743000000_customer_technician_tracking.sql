-- Customer-facing technician profile + en-route GPS window before on-site job start.

alter table public.bookings
  add column if not exists technician_en_route_at timestamptz;

comment on column public.bookings.technician_en_route_at is
  'Set when the assigned technician taps En route in the partner app; enables GPS sharing before job start.';

create or replace function public.get_customer_booking_technician_profile(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  t public.technicians;
  u public.users;
  v_name text;
  phone text;
  partner text;
  display_name text;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found then
    return null;
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = b.customer_id
      and c.user_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  if b.technician_id is null then
    return null;
  end if;

  select * into t from public.technicians where id = b.technician_id;
  if not found then
    return null;
  end if;

  select * into u from public.users where id = t.user_id;

  display_name := coalesce(
    nullif(trim(u.full_name), ''),
    nullif(trim(t.name_as_per_aadhaar), ''),
    'Your technician'
  );

  phone := coalesce(
    nullif(trim(t.personal_phone), ''),
    nullif(trim(u.phone), '')
  );

  select coalesce(nullif(trim(v.trade_name), ''), nullif(trim(v.business_name), ''))
    into partner
  from public.vendors v
  where v.id = t.vendor_id;

  return jsonb_build_object(
    'technician_id', t.id,
    'display_name', display_name,
    'phone_e164', phone,
    'partner_name', partner,
    'avatar_storage_path', t.doc_passport_url,
    'en_route_at', b.technician_en_route_at,
    'is_en_route', b.technician_en_route_at is not null and b.status = 'accepted'::public.booking_status,
    'is_on_site', b.status = 'in_progress'::public.booking_status
  );
end;
$$;

revoke all on function public.get_customer_booking_technician_profile(uuid) from public;
grant execute on function public.get_customer_booking_technician_profile(uuid) to authenticated;

-- Customers may view assigned technician passport photo for active visits.
drop policy if exists technician_documents_select_customer_assigned on storage.objects;
create policy technician_documents_select_customer_assigned
on storage.objects for select to authenticated
using (
  bucket_id = 'technician-documents'
  and exists (
    select 1
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    join public.technicians t on t.id = b.technician_id
    where c.user_id = auth.uid()
      and b.technician_id is not null
      and b.status in (
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status
      )
      and t.doc_passport_url = storage.objects.name
  )
);

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
          when 'in_progress' then 'Visit in progress'
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

    if old.technician_en_route_at is null and new.technician_en_route_at is not null then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_technician_en_route',
        'Technician on the way',
        'Visit ' || ref_code,
        coalesce(new.technician_en_route_at, new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':en_route',
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
