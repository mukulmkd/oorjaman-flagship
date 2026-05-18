-- Vendors (and other roles) could not approve/update role extension rows because
-- assert_user_role_extension() read public.users under the caller's RLS session.
-- users_select_self_or_admin hides other users' rows → trigger raised
-- "users row missing for user_id …" even when the row exists.

create or replace function public.assert_user_role_extension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  select u.role into r from public.users u where u.id = new.user_id;
  if r is null then
    raise exception 'users row missing for user_id %', new.user_id;
  end if;
  if tg_table_name = 'customers' and r <> 'customer'::public.user_role then
    raise exception 'customers.user_id must reference users.role = customer';
  end if;
  if tg_table_name = 'vendors' and r <> 'vendor'::public.user_role then
    raise exception 'vendors.user_id must reference users.role = vendor';
  end if;
  if tg_table_name = 'technicians' and r <> 'technician'::public.user_role then
    raise exception 'technicians.user_id must reference users.role = technician';
  end if;
  return new;
end;
$$;
