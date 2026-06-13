-- Platform fee is charged on GST-exclusive visit value (catalogue prices include 18% GST).

create or replace function public.visit_gross_taxable_value_paise(p_gross_paise bigint)
returns bigint
language sql
immutable
as $$
  select case
    when coalesce(p_gross_paise, 0) <= 0 then 0
    else round(p_gross_paise::numeric / 1.18)::bigint
  end;
$$;

comment on function public.visit_gross_taxable_value_paise(bigint) is
  'Splits GST-inclusive visit gross (paise) into taxable value at 18% GST (matches INDIAN_GST_RATE_PERCENT in API).';

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
  v_net := greatest(0, v_gross - v_platform_fee);

  insert into public.vendor_settlements (
    booking_id, vendor_id, kind, status, currency, reference_code,
    visit_gross_paise, platform_fee_paise, net_payout_paise, metadata
  ) values (
    v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
    coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
    v_gross, v_platform_fee, v_net,
    jsonb_build_object(
      'platform_fee_percent', v_fee_pct,
      'taxable_value_paise', v_taxable,
      'gst_rate_percent', 18,
      'platform_fee_on', 'taxable_ex_gst',
      'auto_created', true,
      'source', 'visit_completed'
    )
  ) returning * into v_existing;

  return v_existing;
end;
$$;

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
  v_taxable bigint;
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

  v_gross := greatest(0, v_wallet.per_visit_alloc_paise);
  if v_gross <= 0 or v_wallet.balance_paise < v_gross then
    raise exception 'insufficient wallet balance';
  end if;

  select coalesce(ps.vendor_platform_fee_percent, 10)::numeric into v_fee_pct
  from public.platform_settings ps where ps.id = 1;

  v_taxable := public.visit_gross_taxable_value_paise(v_gross);
  v_platform_fee := round(v_taxable * v_fee_pct / 100.0);
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
      'taxable_value_paise', v_taxable,
      'gst_rate_percent', 18,
      'platform_fee_on', 'taxable_ex_gst',
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
     'Vendor net from AMC wallet', jsonb_build_object('gross_paise', v_gross, 'taxable_value_paise', v_taxable)),
    (v_wallet.id, 'platform_fee', -v_platform_fee, v_new_balance, v_booking.id, v_settlement.id,
     'OorjaMan fee on AMC visit (ex-GST base)', jsonb_build_object('fee_percent', v_fee_pct, 'taxable_value_paise', v_taxable));

  return v_settlement;
end;
$$;

grant execute on function public.visit_gross_taxable_value_paise(bigint) to authenticated;
