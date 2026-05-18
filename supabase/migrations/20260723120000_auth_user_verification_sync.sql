-- Mirror auth.users contact + verification timestamps into public.users (insert + update).
-- Clients refresh via sync_my_user_from_auth() after OTP / session restore (dummy password login included).

alter table public.users
  add column if not exists phone_verified_at timestamptz,
  add column if not exists email_verified_at timestamptz;

comment on column public.users.phone_verified_at is
  'Copied from auth.users.phone_confirmed_at when the phone is verified (OTP or admin seed).';
comment on column public.users.email_verified_at is
  'Copied from auth.users.email_confirmed_at when the email is verified.';

-- Prevent clients from forging verification timestamps (sync functions set oorjaman.auth_sync).
create or replace function public.guard_users_verification_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('oorjaman.auth_sync', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.phone_verified_at := old.phone_verified_at;
    new.email_verified_at := old.email_verified_at;
  else
    new.phone_verified_at := null;
    new.email_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_verification_columns on public.users;
create trigger users_guard_verification_columns
before insert or update on public.users
for each row execute function public.guard_users_verification_columns();

create or replace function public.auth_user_phone_e164(au auth.users)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(au.phone, au.raw_user_meta_data->>'phone', '')), '');
$$;

create or replace function public.auth_user_email_normalized(au auth.users)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(au.email, ''))), '');
$$;

create or replace function public.auth_user_full_name(au auth.users)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(au.raw_user_meta_data->>'full_name', '')), '');
$$;

create or replace function public.auth_user_role_from_metadata(au auth.users)
returns public.user_role
language plpgsql
immutable
as $$
declare
  raw text;
begin
  raw := nullif(trim(coalesce(au.raw_user_meta_data->>'role', '')), '');
  if raw is null then
    return null;
  end if;
  return public.coerce_user_role(raw);
end;
$$;

create or replace function public.auth_user_phone_verified_at(au auth.users)
returns timestamptz
language sql
immutable
as $$
  select au.phone_confirmed_at;
$$;

create or replace function public.auth_user_email_verified_at(au auth.users)
returns timestamptz
language sql
immutable
as $$
  select au.email_confirmed_at;
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
  v_email := public.auth_user_email_normalized(au);
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

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.apply_auth_user_to_public_users(new);
  return new;
end;
$$;

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.apply_auth_user_to_public_users(new);
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_updated();

-- Backfill verification timestamps for existing auth users.
do $$
declare
  au auth.users;
begin
  for au in select u.* from auth.users u loop
    perform public.apply_auth_user_to_public_users(au);
  end loop;
end;
$$;

create or replace function public.sync_my_user_from_auth()
returns public.users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  au auth.users;
  row public.users;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into au from auth.users where id = auth.uid();
  if not found then
    raise exception 'auth user not found';
  end if;

  perform public.apply_auth_user_to_public_users(au);

  select * into row from public.users where id = auth.uid();
  return row;
end;
$$;

revoke all on function public.sync_my_user_from_auth() from public;
grant execute on function public.sync_my_user_from_auth() to authenticated;

revoke all on function public.apply_auth_user_to_public_users(auth.users) from public;
