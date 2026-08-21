-- Postpaid one-time bookings + partner-collected settlement polarity.

-- ---------------------------------------------------------------------------
-- Bookings: prepaid (default) vs postpaid
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists payment_timing text not null default 'prepaid';

alter table public.bookings
  drop constraint if exists bookings_payment_timing_check;
alter table public.bookings
  add constraint bookings_payment_timing_check
  check (payment_timing in ('prepaid', 'postpaid'));

comment on column public.bookings.payment_timing is
  'prepaid = pay before confirm; postpaid = confirm/assign first, collect after completed.';

-- ---------------------------------------------------------------------------
-- Payments: partner_collected provider + collection channel + payment link id
-- ---------------------------------------------------------------------------
alter table public.payments
  drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check
  check (provider in ('dummy', 'razorpay', 'partner_collected'));

alter table public.payments
  add column if not exists collection_channel text not null default 'oorjaman';
alter table public.payments
  drop constraint if exists payments_collection_channel_check;
alter table public.payments
  add constraint payments_collection_channel_check
  check (collection_channel in ('oorjaman', 'partner'));

alter table public.payments
  add column if not exists razorpay_payment_link_id text;
alter table public.payments
  add column if not exists razorpay_payment_link_url text;

create unique index if not exists payments_rzp_payment_link_uidx
  on public.payments (razorpay_payment_link_id)
  where razorpay_payment_link_id is not null;

-- ---------------------------------------------------------------------------
-- Vendor settlements: who held customer cash
-- ---------------------------------------------------------------------------
alter table public.vendor_settlements
  add column if not exists customer_paid_to text not null default 'oorjaman';
alter table public.vendor_settlements
  drop constraint if exists vendor_settlements_customer_paid_to_check;
alter table public.vendor_settlements
  add constraint vendor_settlements_customer_paid_to_check
  check (customer_paid_to in ('oorjaman', 'partner'));

comment on column public.vendor_settlements.customer_paid_to is
  'oorjaman = platform collected (net payout owed to vendor). partner = vendor held gross (platform fee receivable; net_payout_paise=0).';

-- ---------------------------------------------------------------------------
-- Visit payout: detect partner-collected payment and invert settlement polarity
-- ---------------------------------------------------------------------------
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
      and (
        p.provider = 'partner_collected'
        or p.collection_channel = 'partner'
      )
  ) into v_partner_paid;

  if v_partner_paid then
    v_paid_to := 'partner';
    v_net := 0; -- vendor already holds gross; settle = collect platform fee from vendor
  else
    v_paid_to := 'oorjaman';
    v_net := greatest(0, v_gross - v_platform_fee);
  end if;

  insert into public.vendor_settlements (
    booking_id, vendor_id, kind, status, currency, reference_code,
    visit_gross_paise, platform_fee_paise, net_payout_paise, customer_paid_to, metadata
  ) values (
    v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
    coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
    v_gross, v_platform_fee, v_net, v_paid_to,
    jsonb_build_object(
      'platform_fee_percent', v_fee_pct,
      'taxable_value_paise', v_taxable,
      'gst_rate_percent', 18,
      'platform_fee_on', 'taxable_ex_gst',
      'auto_created', true,
      'source', 'visit_completed',
      'payment_timing', coalesce(v_booking.payment_timing, 'prepaid'),
      'settlement_mode', case
        when v_paid_to = 'partner' then 'partner_collected_fee_receivable'
        else 'platform_collected_net_payout'
      end
    )
  ) returning * into v_existing;

  return v_existing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark partner collected (cash / personal UPI) — never double-charge customer
-- ---------------------------------------------------------------------------
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

  -- Already paid via gateway or partner — idempotent
  select * into v_pay from public.payments
  where booking_id = p_booking_id
    and status = 'success'::public.payment_status
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

  -- Align / create settlement as fee receivable
  select * into v_settlement from public.vendor_settlements
  where booking_id = p_booking_id and kind = 'visit_payout'
  for update;

  select coalesce(ps.vendor_platform_fee_percent, 10)::numeric into v_fee_pct
  from public.platform_settings ps where ps.id = 1;
  v_taxable := public.visit_gross_taxable_value_paise(v_amount);
  v_platform_fee := round(v_taxable * v_fee_pct / 100.0);

  if found then
    update public.vendor_settlements
    set
      customer_paid_to = 'partner',
      visit_gross_paise = v_amount,
      platform_fee_paise = v_platform_fee,
      net_payout_paise = 0,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'settlement_mode', 'partner_collected_fee_receivable',
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
      visit_gross_paise, platform_fee_paise, net_payout_paise, customer_paid_to, metadata
    ) values (
      v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
      coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
      v_amount, v_platform_fee, 0, 'partner',
      jsonb_build_object(
        'platform_fee_percent', v_fee_pct,
        'taxable_value_paise', v_taxable,
        'gst_rate_percent', 18,
        'platform_fee_on', 'taxable_ex_gst',
        'auto_created', true,
        'source', 'partner_collected',
        'settlement_mode', 'partner_collected_fee_receivable',
        'partner_collected_payment_id', v_pay.id,
        'partner_collect_note', p_note
      )
    ) returning * into v_settlement;
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_pay.id,
    'settlement_id', v_settlement.id,
    'platform_fee_paise', v_platform_fee
  );
end;
$$;

revoke all on function public.mark_partner_collected_payment from public;
grant execute on function public.mark_partner_collected_payment to authenticated;
grant execute on function public.mark_partner_collected_payment to service_role;

-- Client may not forge partner_collected success via generic update; use RPC.
-- Allow partner_collected inserts only via RPC (service/definer). No change to insert policy needed if RPC is definer.

comment on function public.mark_partner_collected_payment is
  'Records postpaid cash/UPI collected by partner; flips visit settlement to fee-receivable (net_payout=0).';

-- Technician may read payments for assigned bookings (collect UI polling).
drop policy if exists payments_select_technician_assigned on public.payments;
create policy payments_select_technician_assigned
on public.payments for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id
      and b.technician_id = public.my_technician_id()
  )
);
