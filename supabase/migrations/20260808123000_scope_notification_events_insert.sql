-- SECURITY_REVIEW M1: notification_events insert was `with check (true)` — any authenticated
-- user could inject arbitrary notification events (spoof/spam, target other vendors' inboxes).
-- Constrain inserts to the actor's legitimate scope while preserving every real + dummy flow.
--
-- Legitimate emitters (all via the anon-key acting user; service role / edge functions bypass RLS):
--   * admin console (renewal nudges, ops actions)                    → is_admin()
--   * customer / vendor / technician acting on a booking they own    → is_booking_participant()
--   * approved vendor emitting an ADMIN-audience booking event where  → approved-vendor branch
--     the booking's vendor_id was already cleared (reassignment) so
--     the participant check can't see the link anymore. These never
--     target another vendor's inbox (recipient_audience='admin',
--     recipient_vendor_id is null).
--   * customer self-service AMC "awaiting partner" admin ping         → AMC branch (booking_id null)
--
-- Residual (accepted for a Medium): a booking participant can still emit events within their own
-- booking, and an approved vendor can ping the admin inbox. Full per-event validation would need a
-- SECURITY DEFINER emit RPC; tracked as future hardening.

create or replace function public.is_booking_participant(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and (
        b.customer_id = public.my_customer_id()
        or b.vendor_id = public.my_vendor_id()
        or b.technician_id = public.my_technician_id()
      )
  );
$$;

revoke all on function public.is_booking_participant(uuid) from public;
grant execute on function public.is_booking_participant(uuid) to authenticated;

drop policy if exists notification_events_insert_authenticated on public.notification_events;
drop policy if exists notification_events_insert_scoped on public.notification_events;

create policy notification_events_insert_scoped
on public.notification_events for insert to authenticated
with check (
  public.is_admin()
  or (booking_id is not null and public.is_booking_participant(booking_id))
  or (
    booking_id is not null
    and recipient_audience = 'admin'
    and recipient_vendor_id is null
    and public.is_approved_vendor_user()
  )
  or (
    booking_id is null
    and recipient_vendor_id is null
    and recipient_audience = 'admin'
    and event_type = 'admin_amc_awaiting_partner'
  )
);
