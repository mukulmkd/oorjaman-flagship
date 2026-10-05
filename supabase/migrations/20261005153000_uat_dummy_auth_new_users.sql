-- UAT shared-code sign-in for accounts created after the one-time password reset.
-- The switch below stays off until it is turned on for the UAT database only.
-- Production never inserts that row, so this function and trigger do nothing there.
-- Play review accounts keep their own password.

create table if not exists public.uat_dummy_auth_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false
);

alter table public.uat_dummy_auth_settings enable row level security;
revoke all on table public.uat_dummy_auth_settings from public, anon, authenticated;

create or replace function public.uat_dummy_auth_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.enabled from public.uat_dummy_auth_settings s where s.id),
    false
  );
$$;

revoke all on function public.uat_dummy_auth_enabled() from public;

create or replace function public.force_uat_dummy_auth_password()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.uat_dummy_auth_enabled() then
    return new;
  end if;
  if lower(coalesce(new.email, '')) in (
    'appreview.customer@oorjaman.com',
    'appreview.technician@oorjaman.com'
  ) then
    return new;
  end if;
  new.encrypted_password := extensions.crypt('TestOtp123!', extensions.gen_salt('bf'));
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.force_uat_dummy_auth_password() from public;

drop trigger if exists force_uat_dummy_auth_password on auth.users;
create trigger force_uat_dummy_auth_password
before insert or update of encrypted_password on auth.users
for each row execute function public.force_uat_dummy_auth_password();

-- First sign-in with the shared code creates the account. No Auth email is sent.
create or replace function public.ensure_uat_dummy_auth_user(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_instance uuid;
  v_user auth.users;
begin
  if not public.uat_dummy_auth_enabled() then
    return;
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email.';
  end if;
  if v_email in (
    'appreview.customer@oorjaman.com',
    'appreview.technician@oorjaman.com'
  ) then
    raise exception 'This account uses a password.';
  end if;

  select u.id into v_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;
  if v_id is not null then
    return;
  end if;

  select u.instance_id into v_instance from auth.users u limit 1;
  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    coalesce(v_instance, '00000000-0000-0000-0000-000000000000'),
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt('TestOtp123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
  ) values (
    v_id::text,
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now()
  );

  select * into v_user from auth.users where id = v_id;
  perform public.apply_auth_user_to_public_users(v_user);
end;
$$;

revoke all on function public.ensure_uat_dummy_auth_user(text) from public;
grant execute on function public.ensure_uat_dummy_auth_user(text) to anon, authenticated;
