-- Technician remits the full partner-collected visit amount to OorjaMan.
-- Older partner-collected rows keep remittance_status null (fee-only receivable).

alter table public.payments
  drop constraint if exists payments_collection_channel_check;
alter table public.payments
  add constraint payments_collection_channel_check
  check (collection_channel in ('oorjaman', 'partner', 'technician_remittance'));

alter table public.vendor_settlements
  add column if not exists remittance_status text,
  add column if not exists held_by_technician_id uuid references public.technicians (id) on delete set null,
  add column if not exists remittance_held_since timestamptz,
  add column if not exists remitted_at timestamptz,
  add column if not exists remittance_payment_id uuid references public.payments (id) on delete set null;

alter table public.vendor_settlements
  drop constraint if exists vendor_settlements_remittance_status_check;
alter table public.vendor_settlements
  add constraint vendor_settlements_remittance_status_check
  check (remittance_status is null or remittance_status in ('pending', 'received'));

comment on column public.vendor_settlements.remittance_status is
  'pending = full visit amount still with the assigned technician. received = OorjaMan has the full amount and owes the vendor the net. null = legacy fee-only partner collection, or OorjaMan collected from the customer.';

create index if not exists vendor_settlements_remittance_pending_idx
  on public.vendor_settlements (remittance_held_since)
  where remittance_status = 'pending';

create or replace function public.apply_technician_full_remittance(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_settlement public.vendor_settlements;
  v_net bigint;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found then
    return;
  end if;
  if v_pay.collection_channel is distinct from 'technician_remittance' then
    return;
  end if;
  if v_pay.status <> 'success'::public.payment_status then
    return;
  end if;
  if v_pay.booking_id is null then
    return;
  end if;

  select * into v_settlement
  from public.vendor_settlements
  where booking_id = v_pay.booking_id
    and kind = 'visit_payout'
  for update;
  if not found then
    return;
  end if;
  if v_settlement.remittance_status is distinct from 'pending' then
    return;
  end if;

  v_net := greatest(
    0,
    coalesce(v_settlement.visit_gross_paise, v_pay.amount) - coalesce(v_settlement.platform_fee_paise, 0)
  );

  update public.vendor_settlements
  set
    remittance_status = 'received',
    remitted_at = now(),
    remittance_payment_id = v_pay.id,
    customer_paid_to = 'oorjaman',
    net_payout_paise = v_net,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'settlement_mode', 'platform_collected_net_payout',
      'remitted_gross_paise', v_pay.amount
    ),
    updated_at = now()
  where id = v_settlement.id;
end;
$$;

revoke all on function public.apply_technician_full_remittance(uuid) from public;
grant execute on function public.apply_technician_full_remittance(uuid) to service_role;

create or replace function public.fulfill_razorpay_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_payment_method text default null,
  p_razorpay_payment_status text default 'captured',
  p_amount_paise bigint default null,
  p_method_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_booking_id uuid;
  v_subscription_id uuid;
  v_method text;
  v_already boolean := false;
  v_rz_status text;
begin
  if p_razorpay_order_id is null or nullif(trim(p_razorpay_order_id), '') is null then
    raise exception 'razorpay_order_id required';
  end if;

  v_rz_status := lower(coalesce(nullif(trim(p_razorpay_payment_status), ''), 'captured'));
  if v_rz_status = 'authorized' then
    select * into v_pay
    from public.payments
    where razorpay_order_id = trim(p_razorpay_order_id)
    for update;
    if not found then
      raise exception 'payment not found for order %', p_razorpay_order_id;
    end if;
    if v_pay.status = 'success'::public.payment_status then
      return jsonb_build_object('ok', true, 'already', true, 'payment_id', v_pay.id);
    end if;
    update public.payments
    set
      status = 'authorized'::public.payment_status,
      razorpay_payment_id = coalesce(nullif(trim(p_razorpay_payment_id), ''), razorpay_payment_id),
      razorpay_payment_status = 'authorized',
      razorpay_order_status = coalesce(razorpay_order_status, 'attempted'),
      payment_method = coalesce(nullif(trim(p_payment_method), ''), payment_method),
      method_type = coalesce(nullif(trim(p_method_type), ''), method_type)
    where id = v_pay.id
    returning * into v_pay;
    return jsonb_build_object(
      'ok', true,
      'authorized_only', true,
      'payment_id', v_pay.id,
      'status', v_pay.status
    );
  end if;

  if v_rz_status not in ('captured', 'paid') then
    raise exception 'fulfill requires captured/paid payment status, got %', v_rz_status;
  end if;

  select * into v_pay
  from public.payments
  where razorpay_order_id = trim(p_razorpay_order_id)
  for update;

  if not found then
    raise exception 'payment not found for order %', p_razorpay_order_id;
  end if;

  if v_pay.provider <> 'razorpay' then
    raise exception 'payment provider is not razorpay';
  end if;

  if p_amount_paise is not null and p_amount_paise > 0 and p_amount_paise <> v_pay.amount then
    raise exception 'amount mismatch: order=% webhook=%', v_pay.amount, p_amount_paise;
  end if;

  if v_pay.status = 'success'::public.payment_status
     or v_pay.status = 'partially_refunded'::public.payment_status
     or v_pay.status = 'refunded'::public.payment_status
     or v_pay.status = 'refund_pending'::public.payment_status then
    if v_pay.collection_channel = 'technician_remittance' then
      perform public.apply_technician_full_remittance(v_pay.id);
    end if;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'payment_id', v_pay.id,
      'booking_id', v_pay.booking_id,
      'subscription_id', v_pay.subscription_id
    );
  end if;

  if v_pay.status not in (
    'pending'::public.payment_status,
    'authorized'::public.payment_status
  ) then
    raise exception 'payment is not pending/authorized (status=%)', v_pay.status;
  end if;

  v_method := coalesce(nullif(trim(p_payment_method), ''), 'Razorpay');

  update public.payments
  set
    status = 'success'::public.payment_status,
    paid_at = coalesce(paid_at, now()),
    payment_method = v_method,
    method_type = coalesce(nullif(trim(p_method_type), ''), method_type),
    razorpay_payment_id = coalesce(nullif(trim(p_razorpay_payment_id), ''), razorpay_payment_id),
    razorpay_payment_status = 'captured',
    razorpay_order_status = 'paid',
    error_code = null,
    error_description = null,
    error_reason = null,
    customer_error_category = null,
    customer_error_message = null
  where id = v_pay.id
  returning * into v_pay;

  if nullif(trim(p_razorpay_payment_id), '') is not null then
    insert into public.payment_attempts (
      payment_id, attempt_number, razorpay_payment_id, razorpay_order_id, status
    )
    values (
      v_pay.id,
      v_pay.attempt_number,
      trim(p_razorpay_payment_id),
      trim(p_razorpay_order_id),
      'captured'
    )
    on conflict (payment_id, attempt_number) do update
      set status = excluded.status,
          razorpay_payment_id = coalesce(excluded.razorpay_payment_id, public.payment_attempts.razorpay_payment_id);
  end if;

  v_booking_id := v_pay.booking_id;
  v_subscription_id := v_pay.subscription_id;

  if v_booking_id is not null and v_pay.collection_channel is distinct from 'technician_remittance' then
    update public.bookings
    set status = 'confirmed'::public.booking_status
    where id = v_booking_id
      and status = 'pending_payment'::public.booking_status;
  end if;

  if v_subscription_id is not null and v_pay.collection_channel is distinct from 'technician_remittance' then
    perform public.fund_amc_wallet_from_payment(
      p_subscription_id := v_subscription_id,
      p_payment_id := v_pay.id,
      p_amount_paise := v_pay.amount
    );
  end if;

  if v_pay.collection_channel = 'technician_remittance' then
    perform public.apply_technician_full_remittance(v_pay.id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', v_already,
    'payment_id', v_pay.id,
    'booking_id', v_booking_id,
    'subscription_id', v_subscription_id
  );
end;
$$;

-- New partner-collected visits hold the full amount with the technician.
create or replace function public.mark_partner_collected_payment(
  p_booking_id uuid,
  p_amount_paise bigint default null,
  p_method text default 'Partner collected',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_pay public.payments;
  v_amount bigint;
  v_settlement public.vendor_settlements;
  v_fee_pct numeric;
  v_taxable bigint;
  v_platform_fee bigint;
  v_has_settlement boolean := false;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found'; end if;
  if coalesce(v_booking.payment_timing, 'prepaid') <> 'postpaid' then
    raise exception 'partner collection only for postpaid bookings';
  end if;
  if v_booking.status <> 'completed'::public.booking_status then
    raise exception 'booking must be completed before collection';
  end if;
  if v_booking.vendor_id is null then
    raise exception 'booking has no vendor';
  end if;

  if not public.is_admin()
     and v_booking.technician_id is distinct from public.my_technician_id()
     and v_booking.vendor_id is distinct from public.my_vendor_id() then
    raise exception 'not authorized';
  end if;

  select * into v_pay from public.payments
  where booking_id = p_booking_id
    and status = 'success'::public.payment_status
    and collection_channel is distinct from 'technician_remittance'
  order by paid_at desc nulls last
  limit 1;
  if found then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'payment_id', v_pay.id,
      'provider', v_pay.provider
    );
  end if;

  v_amount := greatest(
    0,
    coalesce(
      nullif(p_amount_paise, 0),
      nullif(v_booking.final_price_cents, 0),
      nullif(v_booking.estimated_price_cents, 0),
      0
    )
  );
  if v_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.payments (
    customer_id, booking_id, amount, currency, status, provider,
    collection_channel, payment_method, method_type, paid_at, attempt_number
  ) values (
    v_booking.customer_id,
    v_booking.id,
    v_amount,
    coalesce(v_booking.currency, 'INR'),
    'success'::public.payment_status,
    'partner_collected',
    'partner',
    coalesce(nullif(trim(p_method), ''), 'Partner collected'),
    'partner_collected',
    now(),
    1
  ) returning * into v_pay;

  select * into v_settlement from public.vendor_settlements
  where booking_id = p_booking_id and kind = 'visit_payout'
  for update;
  v_has_settlement := found;

  select coalesce(ps.vendor_platform_fee_percent, 10)::numeric into v_fee_pct
  from public.platform_settings ps where ps.id = 1;
  v_taxable := public.visit_gross_taxable_value_paise(v_amount);
  v_platform_fee := round(v_taxable * v_fee_pct / 100.0);

  if v_has_settlement then
    update public.vendor_settlements
    set
      customer_paid_to = 'partner',
      visit_gross_paise = v_amount,
      platform_fee_paise = v_platform_fee,
      net_payout_paise = 0,
      remittance_status = 'pending',
      held_by_technician_id = v_booking.technician_id,
      remittance_held_since = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'settlement_mode', 'technician_holds_full',
        'partner_collected_payment_id', v_pay.id,
        'partner_collect_note', p_note,
        'partner_collected_at', now()
      ),
      updated_at = now()
    where id = v_settlement.id
    returning * into v_settlement;
  else
    insert into public.vendor_settlements (
      booking_id, vendor_id, kind, status, currency, reference_code,
      visit_gross_paise, platform_fee_paise, net_payout_paise, customer_paid_to,
      remittance_status, held_by_technician_id, remittance_held_since, metadata
    ) values (
      v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
      coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
      v_amount, v_platform_fee, 0, 'partner',
      'pending', v_booking.technician_id, now(),
      jsonb_build_object(
        'platform_fee_percent', v_fee_pct,
        'taxable_value_paise', v_taxable,
        'gst_rate_percent', 18,
        'platform_fee_on', 'taxable_ex_gst',
        'auto_created', true,
        'source', 'partner_collected',
        'settlement_mode', 'technician_holds_full',
        'partner_collected_payment_id', v_pay.id,
        'partner_collect_note', p_note
      )
    ) returning * into v_settlement;
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_pay.id,
    'settlement_id', v_settlement.id,
    'platform_fee_paise', v_platform_fee,
    'remittance_status', 'pending',
    'gross_paise', v_amount
  );
end;
$$;

create or replace function public.my_pending_technician_remittances()
returns table (
  booking_id uuid,
  reference_code text,
  gross_paise bigint,
  held_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select vs.booking_id, vs.reference_code, vs.visit_gross_paise, vs.remittance_held_since
  from public.vendor_settlements vs
  join public.technicians t on t.id = vs.held_by_technician_id
  where vs.remittance_status = 'pending'
    and t.user_id = auth.uid();
$$;

revoke all on function public.my_pending_technician_remittances() from public;
grant execute on function public.my_pending_technician_remittances() to authenticated;

create or replace function public.technician_remittance_for_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_row public.vendor_settlements;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    return null;
  end if;
  if not public.is_admin()
     and v_booking.technician_id is distinct from public.my_technician_id()
     and v_booking.vendor_id is distinct from public.my_vendor_id() then
    raise exception 'not authorized';
  end if;

  select * into v_row
  from public.vendor_settlements
  where booking_id = p_booking_id
    and kind = 'visit_payout'
    and remittance_status is not null;
  if not found then
    return jsonb_build_object('remittance_status', null);
  end if;

  return jsonb_build_object(
    'remittance_status', v_row.remittance_status,
    'gross_paise', v_row.visit_gross_paise,
    'reference_code', v_row.reference_code,
    'held_since', v_row.remittance_held_since
  );
end;
$$;

revoke all on function public.technician_remittance_for_booking(uuid) from public;
grant execute on function public.technician_remittance_for_booking(uuid) to authenticated;

-- Do not count the technician's transfer as a second customer collection.
drop view if exists public.finance_dashboard_stats;

create view public.finance_dashboard_stats
with (security_invoker = true) as
with earned_visit_fees as (
  select
    coalesce(sum(coalesce(vs.platform_fee_paise, 0)), 0)::bigint as total_paise,
    coalesce(
      sum(coalesce(vs.platform_fee_paise, 0)) filter (where b.subscription_id is not null),
      0
    )::bigint as amc_paise,
    coalesce(
      sum(coalesce(vs.platform_fee_paise, 0)) filter (where b.subscription_id is null),
      0
    )::bigint as one_time_paise
  from public.vendor_settlements vs
  inner join public.bookings b on b.id = vs.booking_id
  where vs.kind = 'visit_payout'::public.vendor_settlement_kind
    and vs.status <> 'waived'::public.vendor_settlement_status
),
settled_penalties as (
  select coalesce(sum(greatest(0, coalesce(vs.penalty_final_paise, 0))), 0)::bigint as paise
  from public.vendor_settlements vs
  where vs.kind = 'cancellation_penalty'::public.vendor_settlement_kind
    and vs.status = 'settled'::public.vendor_settlement_status
),
late_cancel_fees as (
  select coalesce(
    sum(
      greatest(
        0,
        coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
      )
    ),
    0
  )::bigint as paise
  from public.bookings b
  where b.status = 'cancelled'::public.booking_status
    and b.cancelled_at is not null
    and coalesce((b.metadata -> 'customer_cancellation' ->> 'within_grace_window')::boolean, true) = false
)
select
  r.total_revenue_cents,
  r.amc_revenue_cents,
  r.one_time_revenue_cents,
  r.revenue_per_day,
  coalesce(
    (
      select sum(p.amount)::bigint
      from public.payments p
      where p.status = 'success'::public.payment_status
        and coalesce(p.collection_channel, 'oorjaman') <> 'technician_remittance'
    ),
    0::bigint
  ) as total_collections_cents,
  coalesce(
    (
      select sum(p.amount)::bigint
      from public.payments p
      where p.status = 'success'::public.payment_status
        and p.subscription_id is not null
        and coalesce(p.collection_channel, 'oorjaman') <> 'technician_remittance'
    ),
    0::bigint
  ) as amc_contract_collections_cents,
  coalesce(
    (
      select sum(w.balance_paise)::bigint
      from public.amc_wallets w
      where w.status in ('pending_funding'::public.amc_wallet_status, 'funded'::public.amc_wallet_status)
    ),
    0::bigint
  ) as amc_deferred_liability_paise,
  coalesce(
    (
      select sum(vs.net_payout_paise)::bigint
      from public.vendor_settlements vs
      inner join public.bookings b on b.id = vs.booking_id
      where vs.kind = 'visit_payout'::public.vendor_settlement_kind
        and vs.status in (
          'pending_review'::public.vendor_settlement_status,
          'approved'::public.vendor_settlement_status
        )
        and coalesce(vs.remittance_status, 'received') <> 'pending'
        and b.subscription_id is not null
    ),
    0::bigint
  ) as amc_vendor_payables_pending_paise,
  coalesce(
    (
      select sum(vs.net_payout_paise)::bigint
      from public.vendor_settlements vs
      inner join public.bookings b on b.id = vs.booking_id
      where vs.kind = 'visit_payout'::public.vendor_settlement_kind
        and vs.status in (
          'pending_review'::public.vendor_settlement_status,
          'approved'::public.vendor_settlement_status
        )
        and coalesce(vs.remittance_status, 'received') <> 'pending'
        and b.subscription_id is null
    ),
    0::bigint
  ) as one_time_vendor_payables_pending_paise,
  (
    (select total_paise from earned_visit_fees)
    + (select paise from settled_penalties)
    + (select paise from late_cancel_fees)
  ) as recognized_revenue_paise,
  (select amc_paise from earned_visit_fees) as recognized_amc_revenue_paise,
  (select one_time_paise from earned_visit_fees) as recognized_one_time_revenue_paise
from public.recognized_revenue_stats r;

comment on view public.finance_dashboard_stats is
  'Admin finance KPIs. recognized_revenue_paise is the platform fee on completed visits (not waived), plus settled penalties and customer late-cancel fees. total_revenue_cents is only the portion already marked settled. amc_deferred_liability_paise is prepaid AMC still held until visits are completed. Technician remittances are excluded from collections. Visits still held by a technician are excluded from vendor payables.';

grant select on public.finance_dashboard_stats to authenticated;

-- If a payout row is created after the customer already paid the technician,
-- hold the full amount with that technician (same as Mark partner collected).
create or replace function public.create_standard_visit_payout_settlement(p_booking_id uuid)
returns public.vendor_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_existing public.vendor_settlements;
  v_fee_pct numeric;
  v_gross bigint;
  v_taxable bigint;
  v_platform_fee bigint;
  v_net bigint;
  v_partner_paid boolean := false;
  v_paid_to text := 'oorjaman';
  v_mode text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'completed'::public.booking_status then
    raise exception 'booking must be completed';
  end if;
  if v_booking.vendor_id is null then
    raise exception 'booking has no vendor';
  end if;
  if v_booking.subscription_id is not null then
    raise exception 'use release_amc_wallet_visit_payout for amc bookings';
  end if;

  if not public.is_admin() then
    if v_booking.vendor_id is distinct from public.my_vendor_id()
       and v_booking.technician_id is distinct from public.my_technician_id()
       and not exists (
         select 1
         from public.job_reports jr
         where jr.booking_id = p_booking_id
           and jr.technician_id = public.my_technician_id()
       ) then
      raise exception 'not authorized';
    end if;
  end if;

  select * into v_existing from public.vendor_settlements
  where booking_id = p_booking_id and kind = 'visit_payout';
  if found then return v_existing; end if;

  v_gross := greatest(
    0,
    coalesce(
      nullif(v_booking.final_price_cents, 0),
      nullif(v_booking.estimated_price_cents, 0),
      0
    )
  );

  select coalesce(ps.vendor_platform_fee_percent, 10)::numeric into v_fee_pct
  from public.platform_settings ps where ps.id = 1;

  v_taxable := public.visit_gross_taxable_value_paise(v_gross);
  v_platform_fee := round(v_taxable * v_fee_pct / 100.0);

  select exists (
    select 1 from public.payments p
    where p.booking_id = p_booking_id
      and p.status = 'success'::public.payment_status
      and p.collection_channel is distinct from 'technician_remittance'
      and (
        p.provider = 'partner_collected'
        or p.collection_channel = 'partner'
      )
  ) into v_partner_paid;

  if v_partner_paid then
    v_paid_to := 'partner';
    v_net := 0;
    v_mode := 'technician_holds_full';
  else
    v_paid_to := 'oorjaman';
    v_net := greatest(0, v_gross - v_platform_fee);
    v_mode := 'platform_collected_net_payout';
  end if;

  insert into public.vendor_settlements (
    booking_id, vendor_id, kind, status, currency, reference_code,
    visit_gross_paise, platform_fee_paise, net_payout_paise, customer_paid_to,
    remittance_status, held_by_technician_id, remittance_held_since, metadata
  ) values (
    v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
    coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
    v_gross, v_platform_fee, v_net, v_paid_to,
    case when v_partner_paid then 'pending' else null end,
    case when v_partner_paid then v_booking.technician_id else null end,
    case when v_partner_paid then now() else null end,
    jsonb_build_object(
      'platform_fee_percent', v_fee_pct,
      'taxable_value_paise', v_taxable,
      'gst_rate_percent', 18,
      'platform_fee_on', 'taxable_ex_gst',
      'auto_created', true,
      'source', 'visit_completed',
      'payment_timing', coalesce(v_booking.payment_timing, 'prepaid'),
      'settlement_mode', v_mode
    )
  ) returning * into v_existing;

  return v_existing;
end;
$$;
