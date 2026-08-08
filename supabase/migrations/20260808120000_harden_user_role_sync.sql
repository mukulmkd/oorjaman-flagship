-- Security hardening (SECURITY_REVIEW C1): stop privilege escalation via user metadata.
--
-- Before: public.users.role was (re)assigned from the client-controllable
-- auth.users.raw_user_meta_data->>'role' on every auth INSERT *and* UPDATE. Any signed-in
-- user could self-promote to admin via supabase.auth.updateUser({ data: { role: 'admin' } }),
-- because that UPDATE fired on_auth_user_updated -> apply_auth_user_to_public_users -> role sync.
--
-- New rules:
--   * Privileged roles (admin, support) can NEVER come from metadata. They are assigned only by
--     service-role flows that write public.users directly (seed script, admin ops, edge functions).
--   * Self-service roles (customer, technician, vendor) are honored only on the initial INSERT
--     (first sign-up), matching what the apps set in signup metadata.
--   * On UPDATE (row already exists) the role is NEVER changed from metadata — the existing DB
--     value is preserved. Legitimate role transitions happen via service-role writes.

-- Signup-safe role from metadata: privileged roles are stripped (return null).
create or replace function public.auth_user_signup_role_from_metadata(au auth.users)
returns public.user_role
language plpgsql
immutable
as $$
declare
  raw text;
  coerced public.user_role;
begin
  raw := nullif(trim(coalesce(au.raw_user_meta_data->>'role', '')), '');
  if raw is null then
    return null;
  end if;
  coerced := public.coerce_user_role(raw);
  if coerced in ('admin'::public.user_role, 'support'::public.user_role) then
    -- Never allow admin/support to be self-assigned from client metadata.
    return null;
  end if;
  return coerced;
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
  -- Sanitized: admin/support are stripped so they can never arrive via metadata.
  v_role := public.auth_user_signup_role_from_metadata(au);
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
    -- SECURITY: never change role from metadata on update; preserve the DB value.
    -- Role changes must go through service-role writes (seed / admin / edge functions).
    role = public.users.role,
    phone_verified_at = coalesce(excluded.phone_verified_at, public.users.phone_verified_at),
    email_verified_at = coalesce(excluded.email_verified_at, public.users.email_verified_at),
    updated_at = now();

  perform set_config('oorjaman.auth_sync', 'off', true);
end;
$$;

revoke all on function public.auth_user_signup_role_from_metadata(auth.users) from public;
revoke all on function public.apply_auth_user_to_public_users(auth.users) from public;
