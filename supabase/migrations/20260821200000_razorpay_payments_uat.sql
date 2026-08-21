-- Razorpay (UAT test mode first): gateway columns + block clients from forging payment success.

alter table public.payments
  add column if not exists provider text not null default 'dummy',
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

alter table public.payments
  drop constraint if exists payments_provider_check;

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('dummy', 'razorpay'));

comment on column public.payments.provider is
  'Payment source: dummy (local simulate) or razorpay (Orders + webhook).';
comment on column public.payments.razorpay_order_id is
  'Razorpay order_id (order_…); unique when set.';
comment on column public.payments.razorpay_payment_id is
  'Razorpay payment_id (pay_…) after capture.';

create unique index if not exists payments_razorpay_order_id_uidx
  on public.payments (razorpay_order_id)
  where razorpay_order_id is not null;

create unique index if not exists payments_razorpay_payment_id_uidx
  on public.payments (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- Customers may update own dummy payments freely; Razorpay rows may only move pending → failed (abandon).
-- Success for Razorpay is service-role / webhook only.
drop policy if exists payments_update_own on public.payments;
create policy payments_update_own
on public.payments for update to authenticated
using (customer_id = public.my_customer_id() or public.is_admin())
with check (
  (customer_id = public.my_customer_id() or public.is_admin())
  and (
    provider = 'dummy'
    or (provider = 'razorpay' and status = 'failed'::public.payment_status)
  )
);

-- Idempotent fulfillment used by razorpay-webhook (service_role / security definer).
create or replace function public.fulfill_razorpay_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_payment_method text default null
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
begin
  if p_razorpay_order_id is null or nullif(trim(p_razorpay_order_id), '') is null then
    raise exception 'razorpay_order_id required';
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

  if v_pay.status = 'success'::public.payment_status then
    v_already := true;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'payment_id', v_pay.id,
      'booking_id', v_pay.booking_id,
      'subscription_id', v_pay.subscription_id
    );
  end if;

  if v_pay.status <> 'pending'::public.payment_status then
    raise exception 'payment is not pending (status=%)', v_pay.status;
  end if;

  v_method := coalesce(nullif(trim(p_payment_method), ''), 'Razorpay');

  update public.payments
  set
    status = 'success'::public.payment_status,
    paid_at = now(),
    payment_method = v_method,
    razorpay_payment_id = coalesce(nullif(trim(p_razorpay_payment_id), ''), razorpay_payment_id)
  where id = v_pay.id
  returning * into v_pay;

  v_booking_id := v_pay.booking_id;
  v_subscription_id := v_pay.subscription_id;

  if v_booking_id is not null then
    update public.bookings
    set status = 'confirmed'::public.booking_status
    where id = v_booking_id
      and status = 'pending_payment'::public.booking_status;
  end if;

  if v_subscription_id is not null then
    perform public.fund_amc_wallet_from_payment(
      p_subscription_id := v_subscription_id,
      p_payment_id := v_pay.id,
      p_amount_paise := v_pay.amount
    );
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

revoke all on function public.fulfill_razorpay_payment(text, text, text) from public;
grant execute on function public.fulfill_razorpay_payment(text, text, text) to service_role;

comment on function public.fulfill_razorpay_payment(text, text, text) is
  'Webhook-only: mark Razorpay payment success, confirm pending_payment booking or fund AMC wallet.';
