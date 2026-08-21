-- Production Razorpay objects (uses payment_status values added in 20260821210000).
-- Split so new enum labels are committed before use (Postgres 55P04).

-- ---------------------------------------------------------------------------
-- 2) payments columns
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists currency text not null default 'INR',
  add column if not exists amount_refunded bigint not null default 0
    check (amount_refunded >= 0),
  add column if not exists attempt_number integer not null default 1
    check (attempt_number >= 1),
  add column if not exists method_type text,
  add column if not exists razorpay_order_status text,
  add column if not exists razorpay_payment_status text,
  add column if not exists razorpay_refund_status text,
  add column if not exists error_code text,
  add column if not exists error_description text,
  add column if not exists error_source text,
  add column if not exists error_step text,
  add column if not exists error_reason text,
  add column if not exists error_field text,
  add column if not exists error_metadata jsonb,
  add column if not exists customer_error_category text,
  add column if not exists customer_error_message text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.payments_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.payments_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) payment_attempts (per Razorpay payment attempt under an order/payment row)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  razorpay_payment_id text,
  razorpay_order_id text,
  status text not null default 'created',
  failure_reason text,
  failure_category text,
  error_payload jsonb,
  created_at timestamptz not null default now(),
  unique (payment_id, attempt_number)
);

create index if not exists payment_attempts_payment_id_idx
  on public.payment_attempts (payment_id, created_at desc);
create unique index if not exists payment_attempts_rzp_payment_uidx
  on public.payment_attempts (razorpay_payment_id)
  where razorpay_payment_id is not null;

alter table public.payment_attempts enable row level security;

drop policy if exists payment_attempts_select_own on public.payment_attempts;
create policy payment_attempts_select_own on public.payment_attempts
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.payments p
      where p.id = payment_id and p.customer_id = public.my_customer_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4) payment_refunds
-- ---------------------------------------------------------------------------
create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  razorpay_refund_id text,
  razorpay_payment_id text,
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  reason text,
  initiated_by text,
  failure_details jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists payment_refunds_rzp_refund_uidx
  on public.payment_refunds (razorpay_refund_id)
  where razorpay_refund_id is not null;
create index if not exists payment_refunds_payment_id_idx
  on public.payment_refunds (payment_id, created_at desc);

alter table public.payment_refunds enable row level security;

drop policy if exists payment_refunds_select_own on public.payment_refunds;
create policy payment_refunds_select_own on public.payment_refunds
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.payments p
      where p.id = payment_id and p.customer_id = public.my_customer_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) razorpay_webhook_events (idempotency by event id)
-- ---------------------------------------------------------------------------
create table if not exists public.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_type text not null,
  payload jsonb,
  processed_at timestamptz not null default now(),
  unique (event_id)
);

alter table public.razorpay_webhook_events enable row level security;
-- No client policies: service_role only inserts/selects via edge.

-- ---------------------------------------------------------------------------
-- 6) fund_amc_wallet: allow service_role (webhook fulfill path)
-- ---------------------------------------------------------------------------
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

  if exists (
    select 1 from public.amc_wallet_entries e
    where e.wallet_id = v_wallet.id
      and e.kind = 'customer_fund'::public.amc_wallet_entry_kind
      and (e.metadata ->> 'payment_id') = p_payment_id::text
  ) then
    return v_wallet;
  end if;

  if v_wallet.status <> 'pending_funding'::public.amc_wallet_status then
    if v_wallet.status = 'funded'::public.amc_wallet_status then
      return v_wallet;
    end if;
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
grant execute on function public.fund_amc_wallet_from_payment(uuid, uuid, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 7) fulfill: only CAPTURED / paid (never authorized alone)
-- ---------------------------------------------------------------------------
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
  -- Authorized alone is NOT paid.
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
    v_already := true;
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
revoke all on function public.fulfill_razorpay_payment(text, text, text, text, bigint, text) from public;
grant execute on function public.fulfill_razorpay_payment(text, text, text, text, bigint, text) to service_role;

-- Keep 3-arg overload for older callers → captured
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
begin
  return public.fulfill_razorpay_payment(
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_payment_method,
    'captured',
    null,
    null
  );
end;
$$;

grant execute on function public.fulfill_razorpay_payment(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8) Mark payment failed / cancelled / timeout (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.record_razorpay_payment_failure(
  p_razorpay_order_id text,
  p_razorpay_payment_id text default null,
  p_status public.payment_status default 'failed',
  p_error_code text default null,
  p_error_description text default null,
  p_error_source text default null,
  p_error_step text default null,
  p_error_reason text default null,
  p_error_field text default null,
  p_error_metadata jsonb default null,
  p_customer_error_category text default null,
  p_customer_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_status public.payment_status;
begin
  if p_status not in (
    'failed'::public.payment_status,
    'cancelled'::public.payment_status,
    'timeout'::public.payment_status
  ) then
    raise exception 'invalid failure status %', p_status;
  end if;
  v_status := p_status;

  select * into v_pay
  from public.payments
  where razorpay_order_id = trim(p_razorpay_order_id)
  for update;
  if not found then
    raise exception 'payment not found for order %', p_razorpay_order_id;
  end if;

  -- Do not downgrade a captured/refunded payment.
  if v_pay.status in (
    'success'::public.payment_status,
    'partially_refunded'::public.payment_status,
    'refunded'::public.payment_status,
    'refund_pending'::public.payment_status
  ) then
    return jsonb_build_object('ok', true, 'ignored', true, 'payment_id', v_pay.id, 'status', v_pay.status);
  end if;

  update public.payments
  set
    status = v_status,
    razorpay_payment_id = coalesce(nullif(trim(p_razorpay_payment_id), ''), razorpay_payment_id),
    razorpay_payment_status = 'failed',
    razorpay_order_status = coalesce(razorpay_order_status, 'attempted'),
    error_code = p_error_code,
    error_description = p_error_description,
    error_source = p_error_source,
    error_step = p_error_step,
    error_reason = p_error_reason,
    error_field = p_error_field,
    error_metadata = p_error_metadata,
    customer_error_category = p_customer_error_category,
    customer_error_message = p_customer_error_message
  where id = v_pay.id
  returning * into v_pay;

  insert into public.payment_attempts (
    payment_id, attempt_number, razorpay_payment_id, razorpay_order_id, status,
    failure_reason, failure_category, error_payload
  ) values (
    v_pay.id,
    v_pay.attempt_number,
    nullif(trim(p_razorpay_payment_id), ''),
    trim(p_razorpay_order_id),
    'failed',
    p_error_reason,
    p_customer_error_category,
    p_error_metadata
  )
  on conflict (payment_id, attempt_number) do update
    set status = 'failed',
        failure_reason = coalesce(excluded.failure_reason, public.payment_attempts.failure_reason),
        failure_category = coalesce(excluded.failure_category, public.payment_attempts.failure_category),
        error_payload = coalesce(excluded.error_payload, public.payment_attempts.error_payload);

  -- Booking stays pending_payment so customer can retry (new order / attempt).
  return jsonb_build_object('ok', true, 'payment_id', v_pay.id, 'status', v_pay.status);
end;
$$;

revoke all on function public.record_razorpay_payment_failure from public;
grant execute on function public.record_razorpay_payment_failure to service_role;

-- ---------------------------------------------------------------------------
-- 9) Refund apply (webhook)
-- ---------------------------------------------------------------------------
create or replace function public.apply_razorpay_refund(
  p_razorpay_payment_id text,
  p_razorpay_refund_id text,
  p_amount_paise bigint,
  p_refund_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_ref public.payment_refunds;
  v_status text;
  v_total bigint;
begin
  v_status := lower(trim(p_refund_status));
  if v_status not in ('pending', 'processed', 'failed') then
    -- Razorpay uses created/processed/failed etc.
    if v_status in ('created', 'pending') then v_status := 'pending';
    elsif v_status in ('processed', 'completed') then v_status := 'processed';
    else v_status := 'failed';
    end if;
  end if;

  select * into v_pay
  from public.payments
  where razorpay_payment_id = trim(p_razorpay_payment_id)
  for update;
  if not found then
    raise exception 'payment not found for razorpay_payment_id %', p_razorpay_payment_id;
  end if;

  insert into public.payment_refunds (
    payment_id, razorpay_refund_id, razorpay_payment_id, amount_paise, status, reason,
    processed_at
  ) values (
    v_pay.id,
    nullif(trim(p_razorpay_refund_id), ''),
    trim(p_razorpay_payment_id),
    greatest(1, p_amount_paise),
    v_status,
    p_reason,
    case when v_status = 'processed' then now() else null end
  )
  on conflict (razorpay_refund_id) where razorpay_refund_id is not null
  do update set
    status = excluded.status,
    processed_at = case
      when excluded.status = 'processed' then coalesce(public.payment_refunds.processed_at, now())
      else public.payment_refunds.processed_at
    end,
    failure_details = case
      when excluded.status = 'failed' then jsonb_build_object('reason', excluded.reason)
      else public.payment_refunds.failure_details
    end
  returning * into v_ref;

  if v_status = 'processed' then
    select coalesce(sum(amount_paise), 0) into v_total
    from public.payment_refunds
    where payment_id = v_pay.id and status = 'processed';

    update public.payments
    set
      amount_refunded = v_total,
      razorpay_refund_status = case
        when v_total >= amount then 'full'
        when v_total > 0 then 'partial'
        else razorpay_refund_status
      end,
      status = case
        when v_total >= amount then 'refunded'::public.payment_status
        when v_total > 0 then 'partially_refunded'::public.payment_status
        else status
      end
    where id = v_pay.id
    returning * into v_pay;
  elsif v_status = 'pending' then
    update public.payments
    set status = 'refund_pending'::public.payment_status,
        razorpay_refund_status = 'pending'
    where id = v_pay.id
      and status in (
        'success'::public.payment_status,
        'partially_refunded'::public.payment_status,
        'refund_pending'::public.payment_status
      )
    returning * into v_pay;
  elsif v_status = 'failed' then
    update public.payments
    set status = 'refund_failed'::public.payment_status,
        razorpay_refund_status = 'failed'
    where id = v_pay.id
      and status = 'refund_pending'::public.payment_status
    returning * into v_pay;
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_pay.id,
    'refund_id', v_ref.id,
    'payment_status', v_pay.status,
    'amount_refunded', v_pay.amount_refunded
  );
end;
$$;

revoke all on function public.apply_razorpay_refund from public;
grant execute on function public.apply_razorpay_refund to service_role;

-- ---------------------------------------------------------------------------
-- 10) Claim webhook event (returns false if duplicate)
-- ---------------------------------------------------------------------------
create or replace function public.claim_razorpay_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_id is null or trim(p_event_id) = '' then
    return true; -- no id: process without claim
  end if;
  begin
    insert into public.razorpay_webhook_events (event_id, event_type, payload)
    values (trim(p_event_id), coalesce(p_event_type, ''), p_payload);
    return true;
  exception when unique_violation then
    return false;
  end;
end;
$$;

revoke all on function public.claim_razorpay_webhook_event from public;
grant execute on function public.claim_razorpay_webhook_event to service_role;

comment on table public.payment_attempts is 'Per-attempt Razorpay payment trail; failed attempts do not permanently block retry.';
comment on table public.payment_refunds is 'Razorpay refund records; booking status is independent.';
comment on table public.razorpay_webhook_events is 'Idempotency store for Razorpay webhook event ids.';

-- Client may mark razorpay pending → failed/cancelled/timeout for abandon/retry (never success).
drop policy if exists payments_update_own on public.payments;
create policy payments_update_own
on public.payments for update to authenticated
using (customer_id = public.my_customer_id() or public.is_admin())
with check (
  public.is_admin()
  or provider = 'dummy'
  or (
    provider = 'razorpay'
    and status in (
      'failed'::public.payment_status,
      'cancelled'::public.payment_status,
      'timeout'::public.payment_status
    )
  )
);
