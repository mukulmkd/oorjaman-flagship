-- Hot-path RLS InitPlan fixes (k6: vendors ~189ms mean DB, e2e p95 2.4s / max 7s).
-- Wrap auth.uid() as (select auth.uid()) inside helpers, and wrap helper calls in
-- policies as (select …) so Postgres evaluates once per query, not per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.role = 'admin'::public.user_role
  );
$$;

create or replace function public.is_state_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.role = 'state_ops'::public.user_role
  );
$$;

create or replace function public.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.my_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id
  from public.vendors v
  where v.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.my_technician_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.technicians t
  where t.user_id = (select auth.uid())
  limit 1;
$$;

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
      where v.user_id = (select auth.uid())
      limit 1
    ),
    false
  );
$$;

create or replace function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_agents sa
    where sa.user_id = (select auth.uid())
      and sa.is_active = true
  );
$$;

create or replace function public.is_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.role = 'customer'::public.user_role
  );
$$;

revoke all on function public.is_customer() from public;
grant execute on function public.is_customer() to authenticated;

comment on function public.is_customer() is
  'True when auth.uid() is a customer role user. InitPlan-safe for vendor marketplace SELECT.';

-- Customer marketplace list: avoid per-row EXISTS on users + bare auth.uid().
drop policy if exists vendors_select_scope on public.vendors;
create policy vendors_select_scope
on public.vendors for select to authenticated
using (
  (select public.is_admin())
  or (select public.is_support_desk_user())
  or user_id = (select auth.uid())
  or exists (
    select 1
    from public.technicians t
    where t.vendor_id = vendors.id
      and t.user_id = (select auth.uid())
  )
  or (
    vendors.approval_status = 'approved'::public.vendor_approval_status
    and (select public.is_customer())
  )
);

-- Bookings SELECT: wrap role helpers so concurrent list queries stay InitPlan-safe.
drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin
on public.bookings for select to authenticated
using ((select public.is_admin()));

drop policy if exists bookings_select_customer on public.bookings;
create policy bookings_select_customer
on public.bookings for select to authenticated
using (customer_id = (select public.my_customer_id()));

drop policy if exists bookings_select_technician on public.bookings;
create policy bookings_select_technician
on public.bookings for select to authenticated
using (
  technician_id is not null
  and technician_id = (select public.my_technician_id())
);

drop policy if exists bookings_select_support_desk on public.bookings;
create policy bookings_select_support_desk
on public.bookings for select to authenticated
using ((select public.is_support_desk_user()));

drop policy if exists bookings_select_vendor on public.bookings;
create policy bookings_select_vendor
on public.bookings for select to authenticated
using (
  (select public.is_approved_vendor_user())
  and (
    (
      vendor_id is not null
      and vendor_id = (select public.my_vendor_id())
    )
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace": {"vendor_cancelled_reassign": true}}'::jsonb
      and coalesce(
        (metadata -> 'vendor_reassignment' ->> 'previous_vendor_id'),
        ''
      ) = ((select public.my_vendor_id()))::text
    )
  )
);
