-- Core RLS helper functions used across policies (idempotent CREATE OR REPLACE).
-- Reference copy also lives in supabase/policies-base.sql for npm run db:reference.

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
    where u.id = auth.uid()
      and u.role = 'admin'::public.user_role
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
  where c.user_id = auth.uid()
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
  where v.user_id = auth.uid()
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
  where t.user_id = auth.uid()
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
      where v.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_customer_id() to authenticated;
grant execute on function public.my_vendor_id() to authenticated;
grant execute on function public.my_technician_id() to authenticated;
grant execute on function public.is_approved_vendor_user() to authenticated;
