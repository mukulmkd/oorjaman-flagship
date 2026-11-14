-- Technician booking updates (en route / start visit) fail with:
--   infinite recursion detected in policy for relation "bookings"
-- Cause: bookings_update_customer WITH CHECK selected payments under RLS, and
-- payments select policies select bookings again.
-- Fix: check successful payment via a security definer helper (no RLS re-entry).
-- Also correct the broken predicate p.booking_id = p.id → payment for this booking.

create or replace function public.customer_has_successful_booking_payment(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_booking_id is not null
    and exists (
      select 1
      from public.payments p
      where p.booking_id = p_booking_id
        and p.customer_id = public.my_customer_id()
        and p.status = 'success'::public.payment_status
    );
$$;

revoke all on function public.customer_has_successful_booking_payment(uuid) from public;
grant execute on function public.customer_has_successful_booking_payment(uuid) to authenticated;

drop policy if exists bookings_update_customer on public.bookings;

create policy bookings_update_customer
on public.bookings for update to authenticated
using (customer_id = public.my_customer_id())
with check (
  customer_id = public.my_customer_id()
  and (
    status is distinct from 'confirmed'::public.booking_status
    or coalesce(payment_timing, 'prepaid') = 'postpaid'
    or public.customer_owns_funded_amc_subscription(subscription_id)
    or public.client_dummy_payments_allowed()
    or public.customer_has_successful_booking_payment(id)
  )
);
