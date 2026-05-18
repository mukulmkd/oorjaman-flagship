-- Support desk: read customer accounts, linked login profiles, bookings, and AMC for search + context panels.

drop policy if exists customers_select_scope on public.customers;

create policy customers_select_scope
on public.customers for select to authenticated
using (
  public.is_admin()
  or public.is_support_desk_user()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.bookings b
      where b.customer_id = customers.id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
  or exists (
    select 1
    from public.bookings b
    where b.customer_id = customers.id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
      and b.status in (
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status
      )
  )
);

drop policy if exists users_select_support_customer_accounts on public.users;

create policy users_select_support_customer_accounts
on public.users for select to authenticated
using (
  public.is_support_desk_user()
  and role = 'customer'::public.user_role
);

drop policy if exists bookings_select_support_desk on public.bookings;

create policy bookings_select_support_desk
on public.bookings for select to authenticated
using (public.is_support_desk_user());

drop policy if exists subscriptions_select_support_desk on public.subscriptions;

create policy subscriptions_select_support_desk
on public.subscriptions for select to authenticated
using (public.is_support_desk_user());
