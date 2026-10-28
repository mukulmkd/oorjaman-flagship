-- GoTrue matches auth.users.phone without a leading '+'. Storing +E.164 in
-- auth.users broke OTP for existing accounts (lookup miss → create user →
-- public.users phone unique conflict). Keep +E.164 on public.users / profiles;
-- store Auth phones as digits only (91XXXXXXXXXX).

update auth.users
set
  phone = regexp_replace(phone, '^\+', ''),
  updated_at = now()
where phone like '+%';

update auth.identities i
set
  provider_id = regexp_replace(
    coalesce(nullif(trim(i.identity_data->>'phone'), ''), i.provider_id),
    '^\+',
    ''
  ),
  identity_data = jsonb_set(
    jsonb_set(
      coalesce(i.identity_data, '{}'::jsonb),
      '{phone}',
      to_jsonb(regexp_replace(coalesce(i.identity_data->>'phone', ''), '^\+', '')),
      true
    ),
    '{sub}',
    to_jsonb(regexp_replace(coalesce(i.identity_data->>'phone', i.provider_id), '^\+', '')),
    true
  ),
  updated_at = now()
where i.provider = 'phone'
  and (
    i.provider_id like '+%'
    or coalesce(i.identity_data->>'phone', '') like '+%'
    or i.provider_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

create or replace function public.sync_customer_contact_phone_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  e164 text;
  auth_phone text;
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

  auth_phone := regexp_replace(e164, '^\+', '');

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
    phone = auth_phone,
    phone_confirmed_at = coalesce(phone_confirmed_at, now()),
    updated_at = now()
  where id = new.user_id
    and phone is distinct from auth_phone;

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
  )
  values (
    auth_phone,
    new.user_id,
    jsonb_build_object(
      'sub', auth_phone,
      'phone', auth_phone,
      'email_verified', false,
      'phone_verified', true
    ),
    'phone',
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
  set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  select * into au from auth.users where id = new.user_id;
  if au.id is not null then
    perform public.apply_auth_user_to_public_users(au);
  end if;

  return new;
end;
$$;
