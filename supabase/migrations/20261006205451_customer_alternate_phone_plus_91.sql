-- Store customers.alternate_phone as +91XXXXXXXXXX, including numbers already saved as 10 digits.

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

  new.alternate_phone := e164;

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

drop trigger if exists customers_sync_contact_phone_to_auth on public.customers;
create trigger customers_sync_contact_phone_to_auth
before insert or update of alternate_phone on public.customers
for each row
execute function public.sync_customer_contact_phone_to_auth();

update public.customers c
set alternate_phone = c.alternate_phone
from public.users u
where u.id = c.user_id
  and u.role = 'customer'::public.user_role
  and public.format_indian_mobile_e164(c.alternate_phone) is not null
  and c.alternate_phone is distinct from public.format_indian_mobile_e164(c.alternate_phone);

alter table public.customers disable trigger customers_assert_role;

update public.customers c
set alternate_phone = c.alternate_phone
from public.users u
where u.id = c.user_id
  and u.role <> 'customer'::public.user_role
  and public.format_indian_mobile_e164(c.alternate_phone) is not null
  and c.alternate_phone is distinct from public.format_indian_mobile_e164(c.alternate_phone);

alter table public.customers enable trigger customers_assert_role;
