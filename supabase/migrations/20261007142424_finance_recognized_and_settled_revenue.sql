-- Split finance KPIs: recognized revenue is the platform fee earned when a visit
-- is completed (including payouts not yet marked settled). Settled revenue stays
-- on recognized_revenue_stats and is still exposed as total_revenue_cents.

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
  'Admin finance KPIs. recognized_revenue_paise is the platform fee on completed visits (not waived), plus settled penalties and customer late-cancel fees. total_revenue_cents is only the portion already marked settled. amc_deferred_liability_paise is prepaid AMC still held until visits are completed.';

grant select on public.finance_dashboard_stats to authenticated;
