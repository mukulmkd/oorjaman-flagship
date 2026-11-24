-- Fix security_audit_remediation for PROD + UAT already applied:
-- 1) Ensure uat_dummy_auth_settings / uat_dummy_auth_enabled exist (no-op on UAT)
-- 2) Allow customer AMC visit inserts/updates for owned funded active subscriptions
--    (UAT dummy flag must not be required — PROD keeps dummy off)

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

create or replace function public.client_dummy_payments_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.uat_dummy_auth_enabled();
$$;

revoke all on function public.client_dummy_payments_allowed() from public;
grant execute on function public.client_dummy_payments_allowed() to authenticated;

comment on function public.client_dummy_payments_allowed() is
  'True only when uat_dummy_auth_settings.enabled is on (UAT). Production stays false so customers cannot forge dummy payment success.';

create or replace function public.customer_owns_funded_amc_subscription(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_subscription_id is not null
    and exists (
      select 1
      from public.subscriptions s
      join public.amc_wallets w on w.subscription_id = s.id
      where s.id = p_subscription_id
        and s.customer_id = public.my_customer_id()
        and s.status = 'active'::public.subscription_status
        and w.status = 'funded'::public.amc_wallet_status
    );
$$;

revoke all on function public.customer_owns_funded_amc_subscription(uuid) from public;
grant execute on function public.customer_owns_funded_amc_subscription(uuid) to authenticated;

comment on function public.customer_owns_funded_amc_subscription(uuid) is
  'True when the caller owns an active, wallet-funded AMC subscription (customer AMC visit booking inserts).';

drop policy if exists bookings_insert_customer on public.bookings;
create policy bookings_insert_customer
on public.bookings for insert to authenticated
with check (
  customer_id = public.my_customer_id()
  and (
    status = 'pending_payment'::public.booking_status
    or coalesce(payment_timing, 'prepaid') = 'postpaid'
    or public.customer_owns_funded_amc_subscription(subscription_id)
    or public.client_dummy_payments_allowed()
  )
);

drop policy if exists bookings_update_customer on public.bookings;
create policy bookings_update_customer
on public.bookings for update to authenticated
using (customer_id = public.my_customer_id())
with check (
  customer_id = public.my_customer_id()
  and (
    status is distinct from 'confirmed'::public.booking_status
    or coalesce(payment_timing, 'prepaid') = 'postpaid'
    or public.customer_owns_funded_amc_subscription(subscription_id)
    or public.client_dummy_payments_allowed()
    or exists (
      select 1
      from public.payments p
      where p.booking_id = id
        and p.customer_id = public.my_customer_id()
        and p.status = 'success'::public.payment_status
    )
  )
);
