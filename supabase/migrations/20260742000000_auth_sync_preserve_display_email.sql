-- Dummy-auth accounts keep u{phone}@oorjaman-dummy.test in auth.users for password login.
-- Do not overwrite public.users.email (seeded display address) on auth sync.

create or replace function public.auth_user_email_for_public_sync(au auth.users)
returns text
language sql
immutable
as $$
  select case
    when nullif(lower(trim(coalesce(au.email, ''))), '') like '%@oorjaman-dummy.test' then null
    else nullif(lower(trim(coalesce(au.email, ''))), '')
  end;
$$;

create or replace function public.apply_auth_user_to_public_users(au auth.users)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_phone text;
  v_full_name text;
  v_role public.user_role;
  v_phone_verified timestamptz;
  v_email_verified timestamptz;
begin
  v_email := public.auth_user_email_for_public_sync(au);
  v_phone := public.auth_user_phone_e164(au);
  v_full_name := public.auth_user_full_name(au);
  v_role := public.auth_user_role_from_metadata(au);
  v_phone_verified := public.auth_user_phone_verified_at(au);
  v_email_verified := public.auth_user_email_verified_at(au);

  perform set_config('oorjaman.auth_sync', 'on', true);

  insert into public.users (
    id,
    email,
    full_name,
    phone,
    role,
    phone_verified_at,
    email_verified_at
  )
  values (
    au.id,
    v_email,
    v_full_name,
    v_phone,
    coalesce(v_role, 'customer'::public.user_role),
    v_phone_verified,
    v_email_verified
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.users.email),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    phone = coalesce(excluded.phone, public.users.phone),
    role = coalesce(v_role, public.users.role),
    phone_verified_at = coalesce(excluded.phone_verified_at, public.users.phone_verified_at),
    email_verified_at = coalesce(excluded.email_verified_at, public.users.email_verified_at),
    updated_at = now();

  perform set_config('oorjaman.auth_sync', 'off', true);
end;
$$;
