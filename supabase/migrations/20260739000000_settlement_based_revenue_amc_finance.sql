-- Settlement-based recognized revenue (platform fee when admin marks payout settled).
-- AMC contract collections stay as deferred liability until visits are settled.
-- Product-facing name: AMC contract ledger (internal table remains amc_wallets).

comment on table public.amc_wallets is
  'Internal AMC contract ledger: customer prepay held by OorjaMan until each visit payout is settled.';
comment on table public.amc_wallet_entries is
  'Internal ledger entries for AMC contract funding and per-visit vendor release.';

drop view if exists public.finance_dashboard_stats;
drop view if exists public.recognized_revenue_stats;

create view public.recognized_revenue_stats
with (security_invoker = true) as
with visit_fee_settled as (
  select
    ((coalesce(vs.settled_at, vs.updated_at) at time zone 'Asia/Kolkata')::date) as day,
    sum(coalesce(vs.platform_fee_paise, 0))::bigint as revenue_cents,
    sum(
      case when b.subscription_id is not null then coalesce(vs.platform_fee_paise, 0) else 0 end
    )::bigint as amc_revenue_cents,
    sum(
      case when b.subscription_id is null then coalesce(vs.platform_fee_paise, 0) else 0 end
    )::bigint as one_time_revenue_cents
  from public.vendor_settlements vs
  inner join public.bookings b on b.id = vs.booking_id
  where vs.kind = 'visit_payout'::public.vendor_settlement_kind
    and vs.status = 'settled'::public.vendor_settlement_status
  group by 1
),
penalty_settled as (
  select
    ((coalesce(vs.settled_at, vs.updated_at) at time zone 'Asia/Kolkata')::date) as day,
    sum(greatest(0, coalesce(vs.penalty_final_paise, 0)))::bigint as revenue_cents,
    0::bigint as amc_revenue_cents,
    0::bigint as one_time_revenue_cents
  from public.vendor_settlements vs
  where vs.kind = 'cancellation_penalty'::public.vendor_settlement_kind
    and vs.status = 'settled'::public.vendor_settlement_status
  group by 1
),
customer_cancel_fee_daily as (
  select
    ((b.cancelled_at at time zone 'Asia/Kolkata')::date) as day,
    sum(
      greatest(
        0,
        coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
      )
    )::bigint as revenue_cents,
    0::bigint as amc_revenue_cents,
    0::bigint as one_time_revenue_cents
  from public.bookings b
  where b.status = 'cancelled'::public.booking_status
    and b.cancelled_at is not null
    and coalesce((b.metadata -> 'customer_cancellation' ->> 'within_grace_window')::boolean, true) = false
    and greatest(
      0,
      coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
    ) > 0
  group by 1
),
combined as (
  select day, revenue_cents, amc_revenue_cents, one_time_revenue_cents from visit_fee_settled
  union all
  select day, revenue_cents, amc_revenue_cents, one_time_revenue_cents from penalty_settled
  union all
  select day, revenue_cents, amc_revenue_cents, one_time_revenue_cents from customer_cancel_fee_daily
),
by_day as (
  select
    day,
    sum(revenue_cents)::bigint as revenue_cents,
    sum(amc_revenue_cents)::bigint as amc_revenue_cents,
    sum(one_time_revenue_cents)::bigint as one_time_revenue_cents
  from combined
  group by 1
)
select
  coalesce((select sum(revenue_cents) from by_day), 0::bigint) as total_revenue_cents,
  coalesce((select sum(amc_revenue_cents) from by_day), 0::bigint) as amc_revenue_cents,
  coalesce((select sum(one_time_revenue_cents) from by_day), 0::bigint) as one_time_revenue_cents,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'revenue_cents', d.revenue_cents,
          'amc_revenue_cents', d.amc_revenue_cents,
          'one_time_revenue_cents', d.one_time_revenue_cents
        )
        order by d.day
      )
      from by_day d
    ),
    '[]'::jsonb
  ) as revenue_per_day;

comment on view public.recognized_revenue_stats is
  'OorjaMan recognized revenue: settled visit platform fees (AMC + one-time) + settled penalties + customer late-cancel fees.';

grant select on public.recognized_revenue_stats to authenticated;

create view public.finance_dashboard_stats
with (security_invoker = true) as
select
  r.total_revenue_cents,
  r.amc_revenue_cents,
  r.one_time_revenue_cents,
  r.revenue_per_day,
  coalesce(
    (select sum(p.amount)::bigint from public.payments p where p.status = 'success'::public.payment_status),
    0::bigint
  ) as total_collections_cents,
  coalesce(
    (
      select sum(p.amount)::bigint
      from public.payments p
      where p.status = 'success'::public.payment_status
        and p.subscription_id is not null
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
        and b.subscription_id is null
    ),
    0::bigint
  ) as one_time_vendor_payables_pending_paise
from public.recognized_revenue_stats r;

comment on view public.finance_dashboard_stats is
  'Admin finance KPIs: settled revenue split, collections, AMC deferred liability, vendor payables pending settlement.';

grant select on public.finance_dashboard_stats to authenticated;
