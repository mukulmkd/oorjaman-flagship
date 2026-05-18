-- Ensure public.users exists and role can sync when auth user already existed (e.g. re-login with role metadata).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone, role)
  values (
    new.id,
    nullif(lower(trim(coalesce(new.email, ''))), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', '')), ''),
    public.coerce_user_role(new.raw_user_meta_data->>'role')
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.users.email),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    phone = coalesce(excluded.phone, public.users.phone),
    role = coalesce(excluded.role, public.users.role),
    updated_at = now();
  return new;
end;
$$;
