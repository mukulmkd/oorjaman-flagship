-- Store Indian login phones as +91XXXXXXXXXX, including numbers already saved as 91XXXXXXXXXX.

create or replace function public.format_indian_mobile_e164(raw text)
returns text
language sql
immutable
as $$
  select case
    when d ~ '^[6-9][0-9]{9}$' then '+91' || d
    when d ~ '^91[6-9][0-9]{9}$' then '+' || d
    else null
  end
  from (
    select regexp_replace(coalesce(raw, ''), '\D', '', 'g') as d
  ) s;
$$;

create or replace function public.auth_user_phone_e164(au auth.users)
returns text
language sql
immutable
as $$
  select coalesce(
    public.format_indian_mobile_e164(nullif(trim(coalesce(au.phone, au.raw_user_meta_data->>'phone', '')), '')),
    nullif(trim(coalesce(au.phone, au.raw_user_meta_data->>'phone', '')), '')
  );
$$;

create or replace function public.sync_customer_contact_phone_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  e164 text;
  other_id uuid;
  au auth.users;
begin
  e164 := public.format_indian_mobile_e164(new.alternate_phone);
  if e164 is null then
    if regexp_replace(coalesce(new.alternate_phone, ''), '\D', '', 'g') = '' then
      return new;
    end if;
    raise exception 'Enter a 10-digit mobile number';
  end if;

  select u.id
  into other_id
  from auth.users u
  where public.format_indian_mobile_e164(u.phone) = e164
    and u.id <> new.user_id;
  if other_id is not null then
    raise exception 'This mobile number is already used by another account';
  end if;

  update auth.users
  set
    phone = e164,
    phone_confirmed_at = coalesce(phone_confirmed_at, now()),
    updated_at = now()
  where id = new.user_id
    and phone is distinct from e164;

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
  )
  values (
    new.user_id::text,
    new.user_id,
    jsonb_build_object(
      'sub', new.user_id::text,
      'phone', e164,
      'email_verified', false,
      'phone_verified', true
    ),
    'phone',
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
  set
    identity_data = excluded.identity_data,
    updated_at = now();

  select * into au from auth.users where id = new.user_id;
  if au.id is not null then
    perform public.apply_auth_user_to_public_users(au);
  end if;

  return new;
end;
$$;

update auth.users
set
  phone = public.format_indian_mobile_e164(phone),
  updated_at = now()
where phone is not null
  and public.format_indian_mobile_e164(phone) is not null
  and phone is distinct from public.format_indian_mobile_e164(phone);

update auth.identities
set
  identity_data = jsonb_set(
    identity_data,
    '{phone}',
    to_jsonb(public.format_indian_mobile_e164(identity_data->>'phone'))
  ),
  updated_at = now()
where provider = 'phone'
  and public.format_indian_mobile_e164(identity_data->>'phone') is not null
  and (identity_data->>'phone') is distinct from public.format_indian_mobile_e164(identity_data->>'phone');

update public.users
set phone = public.format_indian_mobile_e164(phone)
where phone is not null
  and public.format_indian_mobile_e164(phone) is not null
  and phone is distinct from public.format_indian_mobile_e164(phone);
