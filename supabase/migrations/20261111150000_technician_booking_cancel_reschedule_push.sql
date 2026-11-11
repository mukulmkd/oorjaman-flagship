-- Technician remote push: visit cancelled / rescheduled while assigned.
-- Forward-looking only (no backfill). Uses the existing technician_push_outbox
-- pipeline (same as assign / unassign). No capability gate — matches current
-- assign pushes so any Partner device with a registered token gets them.

create or replace function public.enqueue_technician_booking_schedule_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech_id uuid;
  v_tech_user uuid;
  v_ref text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  v_tech_id := coalesce(new.technician_id, old.technician_id);
  if v_tech_id is null then
    return new;
  end if;

  select t.user_id into v_tech_user
  from public.technicians t
  where t.id = v_tech_id;

  if v_tech_user is null then
    return new;
  end if;

  v_ref := coalesce(nullif(trim(both from new.reference_code), ''), left(new.id::text, 8));

  -- Cancelled while this technician was (or still is) assigned
  if old.status is distinct from new.status
    and new.status = 'cancelled'::public.booking_status
  then
    insert into public.technician_push_outbox (
      user_id,
      technician_id,
      event_type,
      title,
      body,
      data
    )
    values (
      v_tech_user,
      v_tech_id,
      'booking_cancelled',
      'Visit cancelled',
      'Booking ' || v_ref || ' was cancelled. You do not need to attend this visit.',
      jsonb_build_object(
        'kind', 'booking_cancelled',
        'bookingId', new.id,
        'referenceCode', v_ref
      )
    );
  end if;

  -- Rescheduled while assigned (real slot move; skip cancelled/completed)
  if new.technician_id is not null
    and old.scheduled_start is not null
    and new.scheduled_start is not null
    and old.scheduled_start is distinct from new.scheduled_start
    and new.status is distinct from 'cancelled'::public.booking_status
    and new.status is distinct from 'completed'::public.booking_status
  then
    insert into public.technician_push_outbox (
      user_id,
      technician_id,
      event_type,
      title,
      body,
      data
    )
    values (
      v_tech_user,
      new.technician_id,
      'booking_rescheduled',
      'Visit rescheduled',
      'Booking ' || v_ref || ' has a new date or time. Open the app to review.',
      jsonb_build_object(
        'kind', 'booking_rescheduled',
        'bookingId', new.id,
        'referenceCode', v_ref
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enqueue_technician_schedule_push on public.bookings;
create trigger bookings_enqueue_technician_schedule_push
after update of status, scheduled_start, technician_id
on public.bookings
for each row execute function public.enqueue_technician_booking_schedule_push();

comment on function public.enqueue_technician_booking_schedule_push() is
  'Enqueues technician Expo push when an assigned visit is cancelled or rescheduled.';
