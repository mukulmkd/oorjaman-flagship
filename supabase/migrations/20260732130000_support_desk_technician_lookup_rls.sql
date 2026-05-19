-- Support desk: read technician profiles and partner vendors for inbox context panels
-- (mirrors 20260729120000_support_desk_customer_lookup_rls.sql).

drop policy if exists technicians_select_scope on public.technicians;

create policy technicians_select_scope
on public.technicians for select to authenticated
using (
  public.is_admin()
  or public.is_support_desk_user()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendors_select_scope on public.vendors;

create policy vendors_select_scope
on public.vendors for select to authenticated
using (
  public.is_admin()
  or public.is_support_desk_user()
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
