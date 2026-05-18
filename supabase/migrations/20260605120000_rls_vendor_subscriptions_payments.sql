-- Vendors (approved) may read AMC subscriptions for customers they have served (shared bookings),
-- and payments tied to those customers / bookings for finance views.

drop policy if exists subscriptions_select_customer_or_admin on public.subscriptions;
create policy subscriptions_select_customer_or_admin
on public.subscriptions for select to authenticated
using (
  public.is_admin()
  or customer_id = public.my_customer_id()
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.bookings b
      where b.customer_id = subscriptions.customer_id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
);

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
on public.payments for select to authenticated
using (
  customer_id = public.my_customer_id()
  or public.is_admin()
  or (
    public.is_approved_vendor_user()
    and (
      exists (
        select 1
        from public.bookings bk
        where bk.id = payments.booking_id
          and bk.vendor_id = public.my_vendor_id()
      )
      or exists (
        select 1
        from public.bookings bk
        where bk.customer_id = payments.customer_id
          and bk.vendor_id = public.my_vendor_id()
      )
    )
  )
);
