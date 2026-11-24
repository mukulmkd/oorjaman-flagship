-- Security audit remediation (scoped):
-- 1) vendor-intake: remove anon Storage SELECT/INSERT/UPDATE (uploads move to Edge + service role)
-- 2) state_ops_can_read_user: scope to operation states
-- 3) dummy payment success: only when UAT dummy-auth DB flag is on
-- 4) customers cannot insert/update prepaid bookings straight to confirmed unless dummy payments allowed

-- ---------------------------------------------------------------------------
-- 1) vendor-intake Storage: drop anon write/read policies (admin/state_ops keep select)
-- ---------------------------------------------------------------------------
drop policy if exists vendor_intake_select_draft on storage.objects;
drop policy if exists vendor_intake_insert_draft on storage.objects;
drop policy if exists vendor_intake_update_draft on storage.objects;

-- Keep helper for any residual path checks / admin tooling; no longer used by anon policies.
comment on function public.vendor_intake_allows_storage_upload (text) is
  'Draft intake path check (id + draft_access_token). Anon Storage policies removed; uploads go through vendor-intake-upload Edge Function.';

-- ---------------------------------------------------------------------------
-- 2) state_ops users SELECT: operation-scoped (SECURITY DEFINER, no RLS re-entry)
-- ---------------------------------------------------------------------------
create or replace function public.state_ops_can_read_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and (
      exists (
        select 1
        from public.customers c
        where c.user_id = p_user_id
          and (
            public.state_in_my_operation(c.service_default_address ->> 'state')
            or exists (
              select 1
              from public.bookings b
              where b.customer_id = c.id
                and public.state_in_my_operation(b.service_site_address ->> 'state')
            )
          )
      )
      or exists (
        select 1
        from public.technicians t
        where t.user_id = p_user_id
          and public.technician_vendor_in_my_operation(t.vendor_id)
      )
      or exists (
        select 1
        from public.vendors v
        where v.user_id = p_user_id
          and (
            exists (
              select 1
              from unnest(coalesce(v.operating_regions, '{}'::text[])) as region
              where public.state_in_my_operation(region)
            )
            or exists (
              select 1
              from public.bookings b
              where b.vendor_id = v.id
                and public.state_in_my_operation(b.service_site_address ->> 'state')
            )
          )
      )
    );
$$;

revoke all on function public.state_ops_can_read_user(uuid) from public;
grant execute on function public.state_ops_can_read_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Dummy payment success gated by UAT DB switch
-- Ensure settings table exists (PROD may never have run uat_dummy_auth migration).
-- No password-forcing trigger here — settings default off / missing row => false.
-- ---------------------------------------------------------------------------
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

-- Owned + funded active AMC: customers may insert/update confirmed visit bookings
-- (already paid via AMC wallet — must not depend on UAT dummy flag).
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

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own
on public.payments for insert to authenticated
with check (
  customer_id = public.my_customer_id()
  and (
    public.is_admin()
    or provider = 'razorpay'
    or (
      provider = 'dummy'
      and (
        status is distinct from 'success'::public.payment_status
        or public.client_dummy_payments_allowed()
      )
    )
    or provider = 'partner_collected'
  )
);

drop policy if exists payments_update_own on public.payments;
create policy payments_update_own
on public.payments for update to authenticated
using (customer_id = public.my_customer_id() or public.is_admin())
with check (
  public.is_admin()
  or (
    customer_id = public.my_customer_id()
    and (
      (
        provider = 'dummy'
        and (
          status is distinct from 'success'::public.payment_status
          or public.client_dummy_payments_allowed()
        )
      )
      or (
        provider = 'razorpay'
        and status in (
          'failed'::public.payment_status,
          'cancelled'::public.payment_status,
          'timeout'::public.payment_status
        )
      )
      or provider = 'partner_collected'
    )
  )
);

-- Reject authenticated fund of AMC wallet from dummy success when UAT flag is off.
-- Full body matches current production function with one extra provider gate.
create or replace function public.fund_amc_wallet_from_payment(
  p_subscription_id uuid,
  p_payment_id uuid,
  p_amount_paise bigint
)
returns public.amc_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_wallet public.amc_wallets;
  v_sub public.subscriptions;
  v_pay public.payments;
  v_amount bigint;
  v_per_visit bigint;
  v_is_service boolean;
  v_paid_at timestamptz;
begin
  v_amount := greatest(0, round(p_amount_paise));
  if v_amount <= 0 then
    raise exception 'fund amount must be positive';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'subscription not found'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;

  if v_pay.status <> 'success'::public.payment_status then
    raise exception 'payment must be successful before funding wallet';
  end if;

  if v_pay.subscription_id is distinct from p_subscription_id then
    raise exception 'payment subscription mismatch';
  end if;

  if v_pay.customer_id <> v_sub.customer_id then
    raise exception 'payment customer mismatch';
  end if;

  v_is_service := coalesce(auth.role(), '') = 'service_role';
  v_customer_id := public.my_customer_id();

  if not v_is_service and v_customer_id is null and not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if v_customer_id is not null and v_customer_id <> v_sub.customer_id then
    raise exception 'not authorized';
  end if;

  if not v_is_service
     and not public.is_admin()
     and v_pay.provider = 'dummy'
     and not public.client_dummy_payments_allowed() then
    raise exception 'dummy payments are not allowed in this environment';
  end if;

  select * into v_wallet from public.amc_wallets where subscription_id = p_subscription_id for update;
  if not found then raise exception 'amc wallet not found'; end if;

  v_paid_at := coalesce(v_pay.paid_at, now());

  if exists (
    select 1 from public.amc_wallet_entries e
    where e.wallet_id = v_wallet.id
      and e.kind = 'customer_fund'::public.amc_wallet_entry_kind
      and (e.metadata ->> 'payment_id') = p_payment_id::text
  ) then
    if v_sub.status = 'trialing'::public.subscription_status then
      perform public.start_amc_contract_on_payment(p_subscription_id, v_paid_at);
    end if;
    return v_wallet;
  end if;

  if v_wallet.status <> 'pending_funding'::public.amc_wallet_status then
    if v_wallet.status = 'funded'::public.amc_wallet_status then
      if v_sub.status = 'trialing'::public.subscription_status then
        perform public.start_amc_contract_on_payment(p_subscription_id, v_paid_at);
      end if;
      return v_wallet;
    end if;
    raise exception 'wallet is not awaiting funding';
  end if;

  if coalesce(v_sub.visits_included, 0) > 0 then
    v_per_visit := greatest(1, round(v_amount::numeric / v_sub.visits_included));
  else
    v_per_visit := 0;
  end if;

  update public.amc_wallets
  set
    total_funded_paise = v_amount,
    balance_paise = v_amount,
    per_visit_alloc_paise = v_per_visit,
    visits_allocated = coalesce(v_sub.visits_included, 0),
    status = 'funded'::public.amc_wallet_status,
    funded_at = v_paid_at,
    updated_at = now()
  where id = v_wallet.id
  returning * into v_wallet;

  insert into public.amc_wallet_entries (wallet_id, kind, amount_paise, balance_after_paise, note, metadata)
  values (
    v_wallet.id,
    'customer_fund'::public.amc_wallet_entry_kind,
    v_amount,
    v_wallet.balance_paise,
    'AMC contract payment',
    jsonb_build_object('payment_id', p_payment_id)
  );

  perform public.start_amc_contract_on_payment(p_subscription_id, v_paid_at);

  return v_wallet;
end;
$$;

revoke all on function public.fund_amc_wallet_from_payment(uuid, uuid, bigint) from public;
grant execute on function public.fund_amc_wallet_from_payment(uuid, uuid, bigint) to authenticated;
grant execute on function public.fund_amc_wallet_from_payment(uuid, uuid, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Prepaid confirmed bookings: pending_payment / postpaid / funded AMC / UAT dummy
-- ---------------------------------------------------------------------------
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
