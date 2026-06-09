-- Customer OorjaMan Credits (apology wallet) + vendor deferred cancellation penalties.

do $enum$
begin
  create type public.vendor_deferred_penalty_status as enum ('pending', 'applied', 'waived');
exception
  when duplicate_object then null;
end $enum$;

create table if not exists public.customer_oorjaman_credit_grants (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  source_booking_id uuid references public.bookings (id) on delete set null,
  reason text not null default 'vendor_last_hour_cancel',
  credits_issued integer not null check (credits_issued > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_oorjaman_credit_grants_remaining_lte_issued
    check (credits_remaining <= credits_issued)
);

create unique index if not exists customer_oorjaman_credit_grants_source_unique_idx
  on public.customer_oorjaman_credit_grants (customer_id, source_booking_id, reason)
  where source_booking_id is not null;

create index if not exists customer_oorjaman_credit_grants_customer_active_idx
  on public.customer_oorjaman_credit_grants (customer_id, expires_at)
  where credits_remaining > 0;

create table if not exists public.customer_oorjaman_credit_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  grant_id uuid not null references public.customer_oorjaman_credit_grants (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  credits_redeemed integer not null check (credits_redeemed > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists customer_oorjaman_credit_redemptions_customer_idx
  on public.customer_oorjaman_credit_redemptions (customer_id, created_at desc);

create table if not exists public.vendor_deferred_penalties (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  source_booking_id uuid not null references public.bookings (id) on delete cascade,
  penalty_paise bigint not null check (penalty_paise > 0),
  status public.vendor_deferred_penalty_status not null default 'pending',
  applied_booking_id uuid references public.bookings (id) on delete set null,
  vendor_settlement_id uuid references public.vendor_settlements (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists vendor_deferred_penalties_source_unique_idx
  on public.vendor_deferred_penalties (vendor_id, source_booking_id);

create index if not exists vendor_deferred_penalties_vendor_pending_idx
  on public.vendor_deferred_penalties (vendor_id, created_at)
  where status = 'pending';

drop trigger if exists customer_oorjaman_credit_grants_set_updated_at on public.customer_oorjaman_credit_grants;
create trigger customer_oorjaman_credit_grants_set_updated_at
before update on public.customer_oorjaman_credit_grants
for each row execute function public.set_updated_at();

drop trigger if exists vendor_deferred_penalties_set_updated_at on public.vendor_deferred_penalties;
create trigger vendor_deferred_penalties_set_updated_at
before update on public.vendor_deferred_penalties
for each row execute function public.set_updated_at();

comment on table public.customer_oorjaman_credit_grants is
  'Customer apology wallet: 1 OorjaMan Credit = ₹1, redeemable on future one-time bookings.';
comment on table public.customer_oorjaman_credit_redemptions is
  'FIFO redemption ledger against credit grants at checkout.';
comment on table public.vendor_deferred_penalties is
  'Vendor cancellation penalties assessed on the vendor''s next accepted booking.';

alter table public.customer_oorjaman_credit_grants enable row level security;
alter table public.customer_oorjaman_credit_redemptions enable row level security;
alter table public.vendor_deferred_penalties enable row level security;

drop policy if exists customer_oorjaman_credit_grants_select on public.customer_oorjaman_credit_grants;
create policy customer_oorjaman_credit_grants_select
on public.customer_oorjaman_credit_grants for select to authenticated
using (public.is_admin() or customer_id = public.my_customer_id());

drop policy if exists customer_oorjaman_credit_redemptions_select on public.customer_oorjaman_credit_redemptions;
create policy customer_oorjaman_credit_redemptions_select
on public.customer_oorjaman_credit_redemptions for select to authenticated
using (public.is_admin() or customer_id = public.my_customer_id());

drop policy if exists vendor_deferred_penalties_select on public.vendor_deferred_penalties;
create policy vendor_deferred_penalties_select
on public.vendor_deferred_penalties for select to authenticated
using (
  public.is_admin()
  or vendor_id = public.my_vendor_id()
);

create or replace function public.issue_vendor_last_hour_cancel_credits(
  p_customer_id uuid,
  p_source_booking_id uuid,
  p_credits integer default 20
)
returns public.customer_oorjaman_credit_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.customer_oorjaman_credit_grants;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'Credits must be positive';
  end if;

  select * into v_grant
  from public.customer_oorjaman_credit_grants
  where customer_id = p_customer_id
    and source_booking_id = p_source_booking_id
    and reason = 'vendor_last_hour_cancel'
  limit 1;

  if found then
    return v_grant;
  end if;

  insert into public.customer_oorjaman_credit_grants (
    customer_id,
    source_booking_id,
    reason,
    credits_issued,
    credits_remaining,
    issued_at,
    expires_at,
    metadata
  ) values (
    p_customer_id,
    p_source_booking_id,
    'vendor_last_hour_cancel',
    p_credits,
    p_credits,
    now(),
    now() + interval '1 year',
    jsonb_build_object(
      'note', 'Apology credits for partner cancellation within the last hour before your visit.'
    )
  )
  returning * into v_grant;

  return v_grant;
end;
$$;

create or replace function public.queue_vendor_deferred_penalty(
  p_vendor_id uuid,
  p_source_booking_id uuid,
  p_penalty_paise bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns public.vendor_deferred_penalties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.vendor_deferred_penalties;
begin
  if p_penalty_paise is null or p_penalty_paise <= 0 then
    raise exception 'Penalty must be positive';
  end if;

  select * into v_row
  from public.vendor_deferred_penalties
  where vendor_id = p_vendor_id
    and source_booking_id = p_source_booking_id
  limit 1;

  if found then
    return v_row;
  end if;

  insert into public.vendor_deferred_penalties (
    vendor_id,
    source_booking_id,
    penalty_paise,
    status,
    metadata
  ) values (
    p_vendor_id,
    p_source_booking_id,
    p_penalty_paise,
    'pending',
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.redeem_customer_oorjaman_credits(
  p_customer_id uuid,
  p_booking_id uuid,
  p_payment_id uuid,
  p_payable_paise bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.customer_oorjaman_credit_grants;
  v_target_credits integer;
  v_remaining integer;
  v_take integer;
  v_discount_credits integer := 0;
  v_discount_paise bigint := 0;
  v_allocations jsonb := '[]'::jsonb;
begin
  if p_payable_paise is null or p_payable_paise <= 0 then
    return jsonb_build_object(
      'discount_paise', 0,
      'discount_credits', 0,
      'allocations', '[]'::jsonb
    );
  end if;

  v_target_credits := floor(p_payable_paise / 100);
  if v_target_credits <= 0 then
    return jsonb_build_object(
      'discount_paise', 0,
      'discount_credits', 0,
      'allocations', '[]'::jsonb
    );
  end if;

  v_remaining := v_target_credits;

  for v_grant in
    select *
    from public.customer_oorjaman_credit_grants
    where customer_id = p_customer_id
      and credits_remaining > 0
      and expires_at > now()
    order by expires_at asc, issued_at asc
  loop
    exit when v_remaining <= 0;
    v_take := least(v_grant.credits_remaining, v_remaining);
    if v_take <= 0 then
      continue;
    end if;

    update public.customer_oorjaman_credit_grants
    set credits_remaining = credits_remaining - v_take
    where id = v_grant.id
      and credits_remaining = v_grant.credits_remaining;

    if not found then
      raise exception 'Credit balance changed. Refresh and try again.';
    end if;

    insert into public.customer_oorjaman_credit_redemptions (
      customer_id,
      grant_id,
      booking_id,
      payment_id,
      credits_redeemed,
      note
    ) values (
      p_customer_id,
      v_grant.id,
      p_booking_id,
      p_payment_id,
      v_take,
      'Applied at one-time visit checkout'
    );

    v_discount_credits := v_discount_credits + v_take;
    v_remaining := v_remaining - v_take;
    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('grant_id', v_grant.id, 'credits', v_take)
    );
  end loop;

  v_discount_paise := v_discount_credits * 100;

  return jsonb_build_object(
    'discount_paise', v_discount_paise,
    'discount_credits', v_discount_credits,
    'allocations', v_allocations
  );
end;
$$;

grant execute on function public.issue_vendor_last_hour_cancel_credits(uuid, uuid, integer) to authenticated;
grant execute on function public.queue_vendor_deferred_penalty(uuid, uuid, bigint, jsonb) to authenticated;
grant execute on function public.redeem_customer_oorjaman_credits(uuid, uuid, uuid, bigint) to authenticated;
