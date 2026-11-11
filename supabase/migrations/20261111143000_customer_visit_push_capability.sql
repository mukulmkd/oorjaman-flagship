-- Customer visit lifecycle remote push (capability-gated).
--
-- New event types only enqueue when the customer has at least one push token with
-- visit_push_enabled_at set. That stamp is written by the Customer app OTA when it
-- registers the Expo token — so devices without the update never get the new pushes.
--
-- No backfill: this migration does not touch existing bookings or outbox rows.
-- Existing open bookings only notify on *future* status transitions after the
-- customer has installed the update.

-- ---------------------------------------------------------------------------
-- Capability column + token upsert
-- ---------------------------------------------------------------------------

alter table public.customer_push_tokens
  add column if not exists visit_push_enabled_at timestamptz;

comment on column public.customer_push_tokens.visit_push_enabled_at is
  'Set when the customer app OTA that supports visit lifecycle remote push registers this token. Null = legacy client; do not enqueue visit pushes.';

create index if not exists customer_push_tokens_visit_push_enabled_idx
  on public.customer_push_tokens (customer_id)
  where visit_push_enabled_at is not null;

create or replace function public.customer_has_visit_push(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_push_tokens t
    where t.customer_id = p_customer_id
      and t.visit_push_enabled_at is not null
  );
$$;

comment on function public.customer_has_visit_push(uuid) is
  'True when the customer has registered a device that opted into visit lifecycle remote push.';

revoke all on function public.customer_has_visit_push(uuid) from public, anon, authenticated;
grant execute on function public.customer_has_visit_push(uuid) to service_role;

-- Single signature with defaults so PostgREST is not ambiguous across overloads.
-- Older app binaries that omit p_visit_push_enabled keep visit push off.
drop function if exists public.upsert_customer_push_token(text, text);
drop function if exists public.upsert_customer_push_token(text, text, boolean);

create function public.upsert_customer_push_token(
  p_expo_push_token text,
  p_platform text default 'unknown',
  p_visit_push_enabled boolean default false
)
returns public.customer_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  row public.customer_push_tokens;
  v_platform text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  v_customer_id := public.my_customer_id();
  if v_customer_id is null then
    raise exception 'customer profile required';
  end if;

  v_platform := case
    when lower(coalesce(p_platform, '')) in ('ios', 'android') then lower(p_platform)
    else 'unknown'
  end;

  insert into public.customer_push_tokens (
    user_id,
    customer_id,
    expo_push_token,
    platform,
    last_seen_at,
    updated_at,
    visit_push_enabled_at
  )
  values (
    auth.uid(),
    v_customer_id,
    trim(p_expo_push_token),
    v_platform,
    now(),
    now(),
    case when coalesce(p_visit_push_enabled, false) then now() else null end
  )
  on conflict (user_id, expo_push_token) do update
  set
    customer_id = excluded.customer_id,
    platform = excluded.platform,
    last_seen_at = now(),
    updated_at = now(),
    visit_push_enabled_at = case
      when coalesce(p_visit_push_enabled, false)
        then coalesce(public.customer_push_tokens.visit_push_enabled_at, now())
      else public.customer_push_tokens.visit_push_enabled_at
    end
  returning * into row;

  return row;
end;
$$;

grant execute on function public.upsert_customer_push_token(text, text, boolean) to authenticated;

create or replace function public.enqueue_customer_visit_push(
  p_customer_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_customer_id is null then
    return;
  end if;
  if not public.customer_has_visit_push(p_customer_id) then
    return;
  end if;

  select c.user_id into v_user_id
  from public.customers c
  where c.id = p_customer_id;

  if v_user_id is null then
    return;
  end if;

  insert into public.customer_push_outbox (
    user_id,
    customer_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    p_customer_id,
    p_event_type,
    p_title,
    p_body,
    coalesce(p_data, '{}'::jsonb)
  );
end;
$$;

comment on function public.enqueue_customer_visit_push(uuid, text, text, text, jsonb) is
  'Enqueue a customer Expo push only when visit_push capability is enabled on a device token.';

revoke all on function public.enqueue_customer_visit_push(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_customer_visit_push(uuid, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Booking lifecycle triggers (forward-looking only; no backfill)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_customer_booking_lifecycle_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_data jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.customer_id is null then
      return new;
    end if;
    if not public.customer_has_visit_push(new.customer_id) then
      return new;
    end if;

    v_ref := coalesce(nullif(trim(both from new.reference_code), ''), left(new.id::text, 8));
    v_data := jsonb_build_object('bookingId', new.id, 'referenceCode', v_ref);

    -- Payment / confirmation
    if old.status is distinct from new.status
      and new.status = 'confirmed'::public.booking_status
      and old.status = 'pending_payment'::public.booking_status
    then
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_confirmed',
        'OorjaMan - visit confirmed',
        'Thank you. Your payment went through and your solar care visit is booked. We will keep you posted.',
        v_data || jsonb_build_object('kind', 'booking_confirmed')
      );
    end if;

    -- First technician assignment (reassignment already handled elsewhere)
    if old.technician_id is null
      and new.technician_id is not null
    then
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_technician_assigned',
        'Technician assigned',
        'Your technician is assigned for visit ' || v_ref || '. Open the booking for details.',
        v_data || jsonb_build_object('kind', 'booking_technician_assigned')
      );
    end if;

    -- En route
    if old.technician_en_route_at is null
      and new.technician_en_route_at is not null
    then
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_technician_en_route',
        'Technician on the way',
        'Your technician is heading to your site for visit ' || v_ref || '. Open the app to track live.',
        v_data || jsonb_build_object('kind', 'booking_technician_en_route')
      );
    end if;

    -- Completed
    if old.status is distinct from new.status
      and new.status = 'completed'::public.booking_status
    then
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_completed',
        'Visit complete - thank you',
        'Your panel care visit ' || v_ref || ' is done. Open the app to rate your experience.',
        v_data || jsonb_build_object('kind', 'booking_completed')
      );
    end if;

    -- Cancelled
    if old.status is distinct from new.status
      and new.status = 'cancelled'::public.booking_status
    then
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_cancelled',
        'Visit cancelled',
        'Your OorjaMan visit ' || v_ref || ' was cancelled. Open the app for details or to book again.',
        v_data || jsonb_build_object('kind', 'booking_cancelled')
      );
    end if;

    -- Rescheduled (real slot move, not first stamp)
    if old.scheduled_start is not null
      and new.scheduled_start is not null
      and old.scheduled_start is distinct from new.scheduled_start
      and new.status is distinct from 'cancelled'::public.booking_status
      and new.status is distinct from 'completed'::public.booking_status
    then
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_rescheduled',
        'Visit rescheduled',
        'Your visit ' || v_ref || ' has a new date or time. Open the booking to review.',
        v_data || jsonb_build_object('kind', 'booking_rescheduled')
      );
    end if;

    return new;
  end if;

  -- INSERT: pay-later / already-confirmed customer bookings
  if tg_op = 'INSERT' then
    if new.customer_id is null then
      return new;
    end if;
    if not public.customer_has_visit_push(new.customer_id) then
      return new;
    end if;
    if new.status = 'confirmed'::public.booking_status then
      v_ref := coalesce(nullif(trim(both from new.reference_code), ''), left(new.id::text, 8));
      perform public.enqueue_customer_visit_push(
        new.customer_id,
        'booking_confirmed',
        'OorjaMan - visit confirmed',
        'Thank you. Your solar care visit is booked. We will keep you posted as your partner and technician are assigned.',
        jsonb_build_object(
          'kind', 'booking_confirmed',
          'bookingId', new.id,
          'referenceCode', v_ref
        )
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enqueue_customer_lifecycle_push on public.bookings;
create trigger bookings_enqueue_customer_lifecycle_push
after insert or update of status, technician_id, technician_en_route_at, scheduled_start
on public.bookings
for each row execute function public.enqueue_customer_booking_lifecycle_push();

comment on function public.enqueue_customer_booking_lifecycle_push() is
  'Capability-gated customer remote push for visit confirm / tech / en route / complete / cancel / reschedule.';
