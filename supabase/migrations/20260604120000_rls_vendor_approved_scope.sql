-- Operational vendor controls: approved vendor orgs see bookings/team; pending vendors do not.
-- Customers may select approved vendor rows (marketplace) without exposing all vendors to every role.

create or replace function public.is_approved_vendor_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select v.approval_status = 'approved'::public.vendor_approval_status
      from public.vendors v
      where v.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_approved_vendor_user() to authenticated;

drop policy if exists customers_select_scope on public.customers;
create policy customers_select_scope
on public.customers for select to authenticated
using (
  public.is_admin()
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
);

drop policy if exists vendors_select_scope on public.vendors;
create policy vendors_select_scope
on public.vendors for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.technicians t
    where t.vendor_id = vendors.id
      and t.user_id = auth.uid()
  )
  or (
    vendors.approval_status = 'approved'::public.vendor_approval_status
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'customer'::public.user_role
    )
  )
);

drop policy if exists technicians_select_scope on public.technicians;
create policy technicians_select_scope
on public.technicians for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists technicians_update_scope on public.technicians;
create policy technicians_update_scope
on public.technicians for update to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
)
with check (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists technicians_delete_scope on public.technicians;
create policy technicians_delete_scope
on public.technicians for delete to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists technician_locations_select_vendor_team on public.technician_locations;
create policy technician_locations_select_vendor_team
on public.technician_locations for select to authenticated
using (
  public.is_approved_vendor_user()
  and exists (
    select 1
    from public.technicians t
    where t.id = technician_locations.technician_id
      and t.vendor_id is not null
      and t.vendor_id = public.my_vendor_id()
  )
);

drop policy if exists bookings_select_vendor on public.bookings;
create policy bookings_select_vendor
on public.bookings for select to authenticated
using (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
);

drop policy if exists bookings_insert_vendor on public.bookings;
create policy bookings_insert_vendor
on public.bookings for insert to authenticated
with check (
  public.is_approved_vendor_user()
  and vendor_id = public.my_vendor_id()
);

drop policy if exists bookings_update_vendor on public.bookings;
create policy bookings_update_vendor
on public.bookings for update to authenticated
using (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
)
with check (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
);

drop policy if exists job_reports_select_via_booking on public.job_reports;
create policy job_reports_select_via_booking
on public.job_reports for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = job_reports.booking_id
      and (
        public.is_admin()
        or b.customer_id = public.my_customer_id()
        or (
          public.is_approved_vendor_user()
          and b.vendor_id is not null
          and b.vendor_id = public.my_vendor_id()
        )
        or (
          b.technician_id is not null
          and b.technician_id = public.my_technician_id()
        )
      )
  )
);
