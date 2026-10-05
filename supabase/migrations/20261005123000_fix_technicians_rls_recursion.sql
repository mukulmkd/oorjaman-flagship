-- technicians_select_state_ops read vendors under RLS, and vendors_select_scope
-- reads technicians. Partner sign-in selects technicians (and users, which also
-- selects technicians), so Postgres reported infinite recursion on technicians.
-- These helpers run as the owner and do not re-enter those policies.

create or replace function public.technician_vendor_in_my_operation(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and p_vendor_id is not null
    and exists (
      select 1
      from public.vendors v
      where v.id = p_vendor_id
        and (
          exists (
            select 1
            from unnest(coalesce(v.operating_regions, '{}'::text[])) as region
            where public.state_in_my_operation(region)
          )
          or exists (
            select 1
            from public.bookings b
            where b.vendor_id = v.id
              and public.state_in_my_operation(b.service_site_address->>'state')
          )
        )
    );
$$;

create or replace function public.state_ops_can_read_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and (
      exists (select 1 from public.customers c where c.user_id = p_user_id)
      or exists (select 1 from public.technicians t where t.user_id = p_user_id)
      or exists (select 1 from public.vendors v where v.user_id = p_user_id)
    );
$$;

revoke all on function public.technician_vendor_in_my_operation(uuid) from public;
revoke all on function public.state_ops_can_read_user(uuid) from public;
grant execute on function public.technician_vendor_in_my_operation(uuid) to authenticated;
grant execute on function public.state_ops_can_read_user(uuid) to authenticated;

drop policy if exists technicians_select_state_ops on public.technicians;
create policy technicians_select_state_ops
on public.technicians for select to authenticated
using (public.technician_vendor_in_my_operation(vendor_id));

drop policy if exists users_select_state_ops on public.users;
create policy users_select_state_ops
on public.users for select to authenticated
using (public.state_ops_can_read_user(id));
