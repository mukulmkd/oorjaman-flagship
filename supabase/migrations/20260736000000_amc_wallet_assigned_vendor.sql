-- AMC: one assigned vendor per subscription, customer-funded escrow wallet at OorjaMan,
-- vendor paid per completed visit after platform fee (from platform_settings).

alter table public.subscriptions
  add column if not exists assigned_vendor_id uuid references public.vendors (id) on delete set null,
  add column if not exists assigned_vendor_at timestamptz;

create index if not exists subscriptions_assigned_vendor_idx
  on public.subscriptions (assigned_vendor_id)
  where assigned_vendor_id is not null;

comment on column public.subscriptions.assigned_vendor_id is
  'Dedicated AMC partner; all AMC visit bookings use this vendor. Set by admin before scheduling.';

alter table public.payments
  add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;

create index if not exists payments_subscription_id_idx
  on public.payments (subscription_id)
  where subscription_id is not null;

do $enum$
begin
  create type public.amc_wallet_status as enum (
    'pending_funding',
    'funded',
    'depleted',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.amc_wallet_entry_kind as enum (
    'customer_fund',
    'visit_release',
    'platform_fee',
    'refund',
    'adjustment'
  );
exception
  when duplicate_object then null;
end $enum$;

create table if not exists public.amc_wallets (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null unique references public.subscriptions (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  assigned_vendor_id uuid references public.vendors (id) on delete set null,
  total_funded_paise bigint not null default 0 check (total_funded_paise >= 0),
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  released_to_vendor_paise bigint not null default 0 check (released_to_vendor_paise >= 0),
  platform_fee_collected_paise bigint not null default 0 check (platform_fee_collected_paise >= 0),
  per_visit_alloc_paise bigint not null default 0 check (per_visit_alloc_paise >= 0),
  visits_allocated int not null default 0 check (visits_allocated >= 0),
  visits_released int not null default 0 check (visits_released >= 0),
  currency text not null default 'INR',
  status public.amc_wallet_status not null default 'pending_funding',
  funded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists amc_wallets_customer_idx on public.amc_wallets (customer_id);
create index if not exists amc_wallets_vendor_idx on public.amc_wallets (assigned_vendor_id)
  where assigned_vendor_id is not null;

drop trigger if exists amc_wallets_set_updated_at on public.amc_wallets;
create trigger amc_wallets_set_updated_at
before update on public.amc_wallets
for each row execute function public.set_updated_at();

create table if not exists public.amc_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.amc_wallets (id) on delete cascade,
  kind public.amc_wallet_entry_kind not null,
  amount_paise bigint not null,
  balance_after_paise bigint,
  booking_id uuid references public.bookings (id) on delete set null,
  vendor_settlement_id uuid references public.vendor_settlements (id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists amc_wallet_entries_wallet_idx
  on public.amc_wallet_entries (wallet_id, created_at desc);

alter table public.amc_wallets enable row level security;
alter table public.amc_wallet_entries enable row level security;

drop policy if exists amc_wallets_select on public.amc_wallets;
create policy amc_wallets_select
on public.amc_wallets for select to authenticated
using (
  public.is_admin()
  or customer_id = public.my_customer_id()
  or (
    assigned_vendor_id is not null
    and assigned_vendor_id = public.my_vendor_id()
  )
);

drop policy if exists amc_wallets_update_admin on public.amc_wallets;
create policy amc_wallets_update_admin
on public.amc_wallets for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists amc_wallet_entries_select on public.amc_wallet_entries;
create policy amc_wallet_entries_select
on public.amc_wallet_entries for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.amc_wallets w
    where w.id = amc_wallet_entries.wallet_id
      and (
        w.customer_id = public.my_customer_id()
        or (w.assigned_vendor_id is not null and w.assigned_vendor_id = public.my_vendor_id())
      )
  )
);

comment on table public.amc_wallets is
  'OorjaMan-held AMC escrow: customer prepays contract value; releases per completed visit to assigned vendor minus platform fee.';
comment on table public.amc_wallet_entries is
  'Immutable ledger for AMC wallet credits (customer fund) and debits (visit release, platform fee).';

-- Customer may create wallet row when subscribing (paired with subscription insert).
drop policy if exists amc_wallets_insert_customer on public.amc_wallets;
create policy amc_wallets_insert_customer
on public.amc_wallets for insert to authenticated
with check (
  customer_id = public.my_customer_id()
  and exists (
    select 1 from public.subscriptions s
    where s.id = amc_wallets.subscription_id
      and s.customer_id = amc_wallets.customer_id
  )
);

drop policy if exists amc_wallets_insert_admin on public.amc_wallets;
create policy amc_wallets_insert_admin
on public.amc_wallets for insert to authenticated
with check (public.is_admin());

-- Ledger rows: service role / definer RPCs only (no direct client insert).

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

  v_customer_id := public.my_customer_id();
  if v_customer_id is null and not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if v_customer_id is not null and v_customer_id <> v_sub.customer_id then
    raise exception 'not authorized';
  end if;

  select * into v_wallet from public.amc_wallets where subscription_id = p_subscription_id for update;
  if not found then raise exception 'amc wallet not found'; end if;
  if v_wallet.status <> 'pending_funding'::public.amc_wallet_status then
    raise exception 'wallet is not awaiting funding';
  end if;

  v_per_visit := v_wallet.per_visit_alloc_paise;
  if v_per_visit <= 0 and coalesce(v_sub.visits_included, 0) > 0 then
    v_per_visit := greatest(1, round(v_amount::numeric / v_sub.visits_included));
  end if;

  update public.amc_wallets
  set
    total_funded_paise = v_amount,
    balance_paise = v_amount,
    per_visit_alloc_paise = v_per_visit,
    visits_allocated = coalesce(v_sub.visits_included, 0),
    status = 'funded'::public.amc_wallet_status,
    funded_at = coalesce(v_pay.paid_at, now()),
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

  update public.subscriptions
  set status = 'active'::public.subscription_status, updated_at = now()
  where id = p_subscription_id
    and status = 'trialing'::public.subscription_status;

  return v_wallet;
end;
$$;

revoke all on function public.fund_amc_wallet_from_payment(uuid, uuid, bigint) from public;
grant execute on function public.fund_amc_wallet_from_payment(uuid, uuid, bigint) to authenticated;

create or replace function public.admin_assign_amc_subscription_vendor(
  p_subscription_id uuid,
  p_vendor_id uuid
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_vendor public.vendors;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select * into v_vendor from public.vendors where id = p_vendor_id;
  if not found then raise exception 'vendor not found'; end if;
  if v_vendor.approval_status <> 'approved'::public.vendor_approval_status then
    raise exception 'vendor must be approved';
  end if;

  update public.subscriptions
  set
    assigned_vendor_id = p_vendor_id,
    assigned_vendor_at = now(),
    updated_at = now()
  where id = p_subscription_id
  returning * into v_sub;

  if not found then raise exception 'subscription not found'; end if;

  update public.amc_wallets
  set assigned_vendor_id = p_vendor_id, updated_at = now()
  where subscription_id = p_subscription_id;

  return v_sub;
end;
$$;

revoke all on function public.admin_assign_amc_subscription_vendor(uuid, uuid) from public;
grant execute on function public.admin_assign_amc_subscription_vendor(uuid, uuid) to authenticated;

create or replace function public.release_amc_wallet_visit_payout(p_booking_id uuid)
returns public.vendor_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_wallet public.amc_wallets;
  v_fee_pct numeric;
  v_gross bigint;
  v_platform_fee bigint;
  v_net bigint;
  v_new_balance bigint;
  v_settlement public.vendor_settlements;
  v_next_status public.amc_wallet_status;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'completed'::public.booking_status then
    raise exception 'booking must be completed';
  end if;
  if v_booking.subscription_id is null or v_booking.vendor_id is null then
    raise exception 'not an amc booking with vendor';
  end if;

  if not public.is_admin() then
    if v_booking.vendor_id is distinct from public.my_vendor_id()
       and not exists (
         select 1 from public.technicians t
         where t.id = v_booking.technician_id and t.user_id = auth.uid()
       ) then
      raise exception 'not authorized';
    end if;
  end if;

  select * into v_settlement from public.vendor_settlements
  where booking_id = p_booking_id and kind = 'visit_payout';
  if found then return v_settlement; end if;

  select * into v_wallet from public.amc_wallets
  where subscription_id = v_booking.subscription_id for update;
  if not found then raise exception 'amc wallet not found'; end if;
  if v_wallet.status <> 'funded'::public.amc_wallet_status then
    raise exception 'wallet not funded';
  end if;
  if v_wallet.assigned_vendor_id is not null and v_wallet.assigned_vendor_id <> v_booking.vendor_id then
    raise exception 'vendor mismatch for amc';
  end if;

  v_gross := greatest(0, v_wallet.per_visit_alloc_paise);
  if v_gross <= 0 or v_wallet.balance_paise < v_gross then
    raise exception 'insufficient wallet balance';
  end if;

  select coalesce(ps.vendor_platform_fee_percent, 10)::numeric into v_fee_pct
  from public.platform_settings ps where ps.id = 1;

  v_platform_fee := round(v_gross * v_fee_pct / 100.0);
  v_net := greatest(0, v_gross - v_platform_fee);
  v_new_balance := v_wallet.balance_paise - v_gross;
  v_next_status := case when v_new_balance <= 0 then 'depleted'::public.amc_wallet_status else v_wallet.status end;

  insert into public.vendor_settlements (
    booking_id, vendor_id, kind, status, currency, reference_code,
    visit_gross_paise, platform_fee_paise, net_payout_paise, metadata
  ) values (
    v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
    coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
    v_gross, v_platform_fee, v_net,
    jsonb_build_object(
      'platform_fee_percent', v_fee_pct,
      'auto_created', true,
      'source', 'amc_wallet_visit_release',
      'subscription_id', v_booking.subscription_id,
      'wallet_id', v_wallet.id
    )
  ) returning * into v_settlement;

  update public.amc_wallets set
    balance_paise = v_new_balance,
    released_to_vendor_paise = released_to_vendor_paise + v_net,
    platform_fee_collected_paise = platform_fee_collected_paise + v_platform_fee,
    visits_released = visits_released + 1,
    status = v_next_status,
    updated_at = now()
  where id = v_wallet.id;

  insert into public.amc_wallet_entries (wallet_id, kind, amount_paise, balance_after_paise, booking_id, vendor_settlement_id, note, metadata)
  values
    (v_wallet.id, 'visit_release', -v_net, v_new_balance, v_booking.id, v_settlement.id,
     'Vendor net from AMC wallet', jsonb_build_object('gross_paise', v_gross)),
    (v_wallet.id, 'platform_fee', -v_platform_fee, v_new_balance, v_booking.id, v_settlement.id,
     'OorjaMan fee on AMC visit', jsonb_build_object('fee_percent', v_fee_pct));

  return v_settlement;
end;
$$;

revoke all on function public.release_amc_wallet_visit_payout(uuid) from public;
grant execute on function public.release_amc_wallet_visit_payout(uuid) to authenticated;
