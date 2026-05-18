-- Sync auth.users.phone into public.users.phone on sign-up (phone OTP flow).
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
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    phone = coalesce(excluded.phone, public.users.phone),
    updated_at = now();
  return new;
end;
$$;
