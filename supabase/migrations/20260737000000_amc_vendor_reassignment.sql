-- AMC vendor reassignment: admin can change partner per subscription (optionally open visits)
-- or per booking. Wallet pays whoever completed the visit.

drop function if exists public.admin_assign_amc_subscription_vendor(uuid, uuid);

create or replace function public.admin_assign_amc_subscription_vendor(
  p_subscription_id uuid,
  p_vendor_id uuid,
  p_reassign_open_bookings boolean default true
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

  if p_reassign_open_bookings then
    update public.bookings b
    set
      vendor_id = p_vendor_id,
      technician_id = null,
      status = case
        when b.status = 'accepted'::public.booking_status then 'confirmed'::public.booking_status
        else b.status
      end,
      metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object(
        'amc_vendor_reassignment', jsonb_build_object(
          'previous_vendor_id', b.vendor_id,
          'reassigned_at', now(),
          'reassigned_by', 'admin',
          'scope', 'subscription',
          'subscription_id', p_subscription_id
        ),
        'vendor_reassignment', coalesce(b.metadata->'vendor_reassignment', '{}'::jsonb) || jsonb_build_object(
          'awaiting_admin_assignment', false,
          'reassigned_at', now(),
          'reassigned_vendor_id', p_vendor_id,
          'previous_vendor_id', b.vendor_id
        ),
        'vendor_response', jsonb_build_object('anchor_at', now())
      ),
      updated_at = now()
    where b.subscription_id = p_subscription_id
      and b.status in (
        'confirmed'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status
      )
      and b.vendor_id is distinct from p_vendor_id;
  end if;

  return v_sub;
end;
$$;

revoke all on function public.admin_assign_amc_subscription_vendor(uuid, uuid, boolean) from public;
grant execute on function public.admin_assign_amc_subscription_vendor(uuid, uuid, boolean) to authenticated;

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
