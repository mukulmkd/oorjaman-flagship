-- Copy a customer's contact mobile onto their login so mobile OTP uses the same account.
-- New completed registrations cannot be saved without that number.

create or replace function public.sync_customer_contact_phone_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  digits text;
  e164 text;
  other_id uuid;
  au auth.users;
begin
  digits := regexp_replace(coalesce(new.alternate_phone, ''), '\D', '', 'g');
  if digits = '' then
    return new;
  end if;

  if length(digits) = 10 then
    e164 := '91' || digits;
  elsif length(digits) = 12 and left(digits, 2) = '91' then
    e164 := digits;
  else
    raise exception 'Enter a 10-digit mobile number';
  end if;

  if substring(e164 from 3 for 1) !~ '^[6-9]$' then
    raise exception 'Enter a valid mobile number';
  end if;

  select u.id
  into other_id
  from auth.users u
  where u.phone = e164
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

revoke all on function public.sync_customer_contact_phone_to_auth() from public;
revoke all on function public.sync_customer_contact_phone_to_auth() from anon;
revoke all on function public.sync_customer_contact_phone_to_auth() from authenticated;

drop trigger if exists customers_sync_contact_phone_to_auth on public.customers;
create trigger customers_sync_contact_phone_to_auth
after insert or update of alternate_phone on public.customers
for each row
execute function public.sync_customer_contact_phone_to_auth();

alter table public.customers
  drop constraint if exists customers_completed_profile_requires_mobile;

alter table public.customers
  add constraint customers_completed_profile_requires_mobile
  check (
    onboarding_completed_at is null
    or (
      length(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g')) = 10
      and left(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g'), 1) ~ '[6-9]'
    )
    or (
      length(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g')) = 12
      and left(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g'), 2) = '91'
      and substring(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g') from 3 for 1) ~ '[6-9]'
    )
  ) not valid;

-- Existing profiles: copy the contact mobile onto logins that do not have one yet.
update public.customers c
set alternate_phone = c.alternate_phone
from public.users u
where u.id = c.user_id
  and u.role = 'customer'
  and nullif(trim(u.phone), '') is null
  and nullif(trim(c.alternate_phone), '') is not null;
