-- Booking lifecycle v2: payment-gated progress + renamed vendor/assignment states.
-- Safe for already-migrated databases: no-op when `booking_status` already has `pending_payment`.

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'booking_status'
      and e.enumlabel = 'pending_payment'
  ) then
    raise notice 'booking_status already migrated; skipping 20260528120000.';
    return;
  end if;

  execute 'alter table public.bookings alter column status drop default';

  if not exists (
    select 1
    from pg_type t
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'booking_status_new'
  ) then
    execute $sql$
      create type public.booking_status_new as enum (
        'pending_payment',
        'confirmed',
        'accepted',
        'in_progress',
        'completed',
        'cancelled'
      )
    $sql$;
  end if;

  execute 'alter table public.bookings alter column status type text using (status::text)';

  execute $sql$
    update public.bookings
    set status = case status
      when 'draft' then 'pending_payment'
      when 'requested' then 'confirmed'
      when 'awaiting_confirmation' then 'confirmed'
      when 'confirmed' then 'confirmed'
      when 'assigned' then 'accepted'
      when 'in_progress' then 'in_progress'
      when 'completed' then 'completed'
      when 'cancelled' then 'cancelled'
      when 'no_show' then 'cancelled'
      else 'confirmed'
    end
  $sql$;

  execute 'alter table public.bookings alter column status type public.booking_status_new using (status::public.booking_status_new)';
  execute 'alter table public.bookings alter column status set default ''pending_payment''::public.booking_status_new';
  execute 'drop type public.booking_status';
  execute 'alter type public.booking_status_new rename to booking_status';
end $$;
