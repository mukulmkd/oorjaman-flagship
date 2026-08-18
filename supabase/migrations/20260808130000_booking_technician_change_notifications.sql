-- =============================================================================
-- Auto-notify on booking technician assignment / reassignment.
--
-- When a booking's technician_id changes (vendor "Change technician", first
-- assignment on accept, or any admin/service path), enqueue push notifications
-- to the right people via the existing outbox pipeline — automatically, no
-- matter which client made the change:
--   * NEW technician  → "New job assigned"          (technician_push_outbox)
--   * OLD technician  → "Job reassigned"            (technician_push_outbox) [reassign only]
--   * CUSTOMER        → "Your technician changed"   (customer_push_outbox)   [reassign only]
--   * CUSTOMER feed   → booking_technician_reassigned activity                [reassign only]
--
-- Admin in-app + vendor in-app events are emitted from the API layer
-- (vendorReassignBookingTechnician / vendorAcceptBookingRequest) and are not
-- duplicated here. First-assignment customer activity is already handled by
-- log_customer_site_activity_from_booking (null → set); this trigger only adds
-- the customer-facing pieces for a genuine *change* (old technician present).
--
-- SECURITY DEFINER so it can write the service-role-only outbox tables. Push
-- dispatch happens via the existing AFTER INSERT dispatch triggers on the
-- outbox tables. Idempotent (create or replace + drop/create trigger).
-- =============================================================================

create or replace function public.enqueue_booking_technician_change_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_addr_id text;
  v_new_tech_user uuid;
  v_old_tech_user uuid;
  v_customer_user uuid;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.technician_id is not distinct from old.technician_id then
    return new;
  end if;

  v_ref := coalesce(nullif(trim(both from new.reference_code), ''), left(new.id::text, 8));

  -- NEW technician assigned (first assignment or reassignment).
  if new.technician_id is not null then
    select t.user_id into v_new_tech_user
      from public.technicians t
      where t.id = new.technician_id;

    if v_new_tech_user is not null then
      insert into public.technician_push_outbox (user_id, technician_id, event_type, title, body, data)
      values (
        v_new_tech_user,
        new.technician_id,
        'booking_technician_assigned',
        'New job assigned',
        'You have been assigned booking ' || v_ref || '. Open the app for visit details.',
        jsonb_build_object('kind', 'booking_technician_assigned', 'bookingId', new.id)
      );
    end if;
  end if;

  -- Everything below is reassignment-only (a previous technician existed).
  if old.technician_id is not null then
    -- OLD technician removed.
    select t.user_id into v_old_tech_user
      from public.technicians t
      where t.id = old.technician_id;

    if v_old_tech_user is not null then
      insert into public.technician_push_outbox (user_id, technician_id, event_type, title, body, data)
      values (
        v_old_tech_user,
        old.technician_id,
        'booking_technician_unassigned',
        'Job reassigned',
        'Booking ' || v_ref || ' has been reassigned to another technician.',
        jsonb_build_object('kind', 'booking_technician_unassigned', 'bookingId', new.id)
      );
    end if;

    -- CUSTOMER push + activity feed.
    select c.user_id into v_customer_user
      from public.customers c
      where c.id = new.customer_id;

    if v_customer_user is not null then
      insert into public.customer_push_outbox (user_id, customer_id, event_type, title, body, data)
      values (
        v_customer_user,
        new.customer_id,
        'booking_technician_changed',
        'Your technician has changed',
        'A new technician has been assigned to your booking ' || v_ref || '.',
        jsonb_build_object('kind', 'booking_technician_changed', 'bookingId', new.id)
      );
    end if;

    v_addr_id := public.booking_metadata_service_address_id(new.metadata);
    if v_addr_id is not null then
      perform public.insert_customer_site_activity(
        new.customer_id,
        v_addr_id,
        'booking_technician_assigned',
        'Technician changed',
        'Visit ' || v_ref,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        -- Per-technician dedupe key so each reassignment logs its own entry
        -- (the first-assignment entry uses ':technician_assigned').
        'booking:' || new.id::text || ':technician_reassigned:' || new.technician_id::text,
        jsonb_build_object(
          'reference_code', v_ref,
          'status', new.status,
          'technician_id', new.technician_id,
          'previous_technician_id', old.technician_id
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enqueue_technician_change_notifications on public.bookings;

create trigger bookings_enqueue_technician_change_notifications
after update of technician_id on public.bookings
for each row
when (new.technician_id is distinct from old.technician_id)
execute function public.enqueue_booking_technician_change_notifications();

comment on function public.enqueue_booking_technician_change_notifications() is
  'Enqueues technician/customer push (+ customer activity on reassign) when bookings.technician_id changes. Admin/vendor in-app events come from the API layer.';
