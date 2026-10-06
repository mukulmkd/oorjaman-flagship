-- An unpaid AMC is a draft. The contract year and visit dates begin when payment is captured.
-- A draft left unpaid for 14 days is deactivated and kept.

create or replace function public.start_amc_contract_on_payment(
  p_subscription_id uuid,
  p_paid_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_months int;
  v_starts timestamptz;
  v_ends timestamptz;
  v_visits int;
  v_total_ms double precision;
  v_step_ms double precision;
  v_i int;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_has_booking boolean;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription not found';
  end if;

  select exists (
    select 1
    from public.bookings b
    where b.subscription_id = p_subscription_id
      and b.status <> 'cancelled'::public.booking_status
  ) into v_has_booking;

  if v_has_booking or exists (
    select 1
    from public.subscription_visit_slots v
    where v.subscription_id = p_subscription_id
      and v.booking_id is not null
  ) then
    update public.subscriptions
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'amc_phase', 'active',
      'contract_started', true
    )
    where id = p_subscription_id;
    return;
  end if;

  v_starts := coalesce(p_paid_at, now());
  v_months := coalesce(nullif(v_sub.metadata ->> 'contract_months', '')::int, 12);
  if v_months < 1 then
    v_months := 12;
  end if;
  v_ends := v_starts + make_interval(months => v_months);
  v_visits := coalesce(v_sub.visits_included, 0);

  update public.subscriptions
  set
    starts_at = v_starts,
    ends_at = v_ends,
    visits_used = 0,
    status = 'active'::public.subscription_status,
    assigned_vendor_id = case
      when status = 'trialing'::public.subscription_status then null
      else assigned_vendor_id
    end,
    assigned_vendor_at = case
      when status = 'trialing'::public.subscription_status then null
      else assigned_vendor_at
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'amc_phase', 'active',
      'contract_started', true,
      'contract_started_on', v_starts
    ),
    updated_at = now()
  where id = p_subscription_id
    and status in ('trialing'::public.subscription_status, 'active'::public.subscription_status);

  delete from public.subscription_visit_slots
  where subscription_id = p_subscription_id
    and booking_id is null
    and status = 'pending';

  if v_visits <= 0 then
    return;
  end if;

  v_total_ms := extract(epoch from (v_ends - v_starts)) * 1000;
  v_step_ms := greatest(v_total_ms / greatest(v_visits, 1), 86400000);

  for v_i in 1..v_visits loop
    v_slot_start := v_starts + ((v_step_ms * (v_i - 1)) * interval '1 millisecond');
    exit when v_slot_start >= v_ends;
    v_slot_end := least(v_slot_start + interval '2 hours', v_ends);
    exit when v_slot_end <= v_slot_start;
    insert into public.subscription_visit_slots (
      subscription_id,
      sequence,
      ideal_scheduled_start,
      ideal_scheduled_end,
      status
    ) values (
      p_subscription_id,
      v_i,
      v_slot_start,
      v_slot_end,
      'pending'
    );
  end loop;
end;
$$;

revoke all on function public.start_amc_contract_on_payment(uuid, timestamptz) from public;
revoke all on function public.start_amc_contract_on_payment(uuid, timestamptz) from anon, authenticated;

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

-- Existing unpaid contracts become drafts. Visit dates are removed until payment.
update public.subscriptions
set
  assigned_vendor_id = null,
  assigned_vendor_at = null,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'amc_phase', 'draft',
    'contract_started', false
  )
where status = 'trialing'::public.subscription_status;

update public.amc_wallets w
set assigned_vendor_id = null
from public.subscriptions s
where w.subscription_id = s.id
  and s.status = 'trialing'::public.subscription_status
  and w.status = 'pending_funding'::public.amc_wallet_status;

delete from public.subscription_visit_slots v
using public.subscriptions s
where v.subscription_id = s.id
  and s.status = 'trialing'::public.subscription_status
  and v.booking_id is null
  and v.status = 'pending';

update public.subscriptions
set
  status = 'expired'::public.subscription_status,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'amc_phase', 'draft_inactive',
    'contract_started', false,
    'draft_deactivated_at', now(),
    'draft_deactivated_reason', 'unpaid_14_days'
  )
where status = 'trialing'::public.subscription_status
  and created_at < now() - interval '14 days';

-- Paid contracts with no visit yet start on the payment timestamp.
do $$
declare
  r record;
begin
  for r in
    select s.id, coalesce(w.funded_at, s.starts_at) as paid_at
    from public.subscriptions s
    join public.amc_wallets w
      on w.subscription_id = s.id
     and w.status = 'funded'::public.amc_wallet_status
    where s.status = 'active'::public.subscription_status
  loop
    perform public.start_amc_contract_on_payment(r.id, r.paid_at);
  end loop;
end $$;
