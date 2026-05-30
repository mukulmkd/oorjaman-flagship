-- Recognized revenue = platform fee on customer payments (completed visits) + cancellation fees.
-- Payment totals remain on revenue_stats (successful gateway payments, gross).

drop view if exists public.recognized_revenue_stats;

create view public.recognized_revenue_stats
with (security_invoker = true) as
with platform_fee as (
  select coalesce(
    (select ps.vendor_platform_fee_percent from public.platform_settings ps where ps.id = 1),
    10::numeric
  ) as fee_percent
),
commission_daily as (
  select
    ((coalesce(p.paid_at, p.created_at) at time zone 'Asia/Kolkata')::date) as day,
    sum(round(p.amount::numeric * pf.fee_percent / 100.0))::bigint as revenue_cents
  from public.payments p
  inner join public.bookings b on b.id = p.booking_id
  cross join platform_fee pf
  where p.status = 'success'::public.payment_status
    and b.status = 'completed'::public.booking_status
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
    )::bigint as revenue_cents
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
vendor_penalty_daily as (
  select
    ((vs.created_at at time zone 'Asia/Kolkata')::date) as day,
    sum(
      greatest(
        0,
        coalesce(vs.penalty_final_paise, vs.penalty_assessed_paise, 0)
      )
    )::bigint as revenue_cents
  from public.vendor_settlements vs
  where vs.kind = 'cancellation_penalty'
  group by 1
),
combined as (
  select day, revenue_cents from commission_daily
  union all
  select day, revenue_cents from customer_cancel_fee_daily
  union all
  select day, revenue_cents from vendor_penalty_daily
),
by_day as (
  select day, sum(revenue_cents)::bigint as revenue_cents
  from combined
  group by 1
)
select
  coalesce((select sum(revenue_cents) from by_day), 0::bigint) as total_revenue_cents,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('day', d.day, 'revenue_cents', d.revenue_cents)
        order by d.day
      )
      from by_day d
    ),
    '[]'::jsonb
  ) as revenue_per_day;

comment on view public.recognized_revenue_stats is
  'Platform revenue: vendor_platform_fee_percent of successful payments on completed visits, plus customer late-cancel and vendor penalty fees.';

grant select on public.recognized_revenue_stats to authenticated;
