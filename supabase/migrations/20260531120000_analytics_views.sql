-- Dashboard analytics views (aggregates respect RLS on underlying tables - use admin session or service role for global totals).

drop view if exists public.subscription_stats;
drop view if exists public.vendor_stats;
drop view if exists public.revenue_stats;
drop view if exists public.booking_stats;

-- -----------------------------------------------------------------------------
-- booking_stats - single row
-- pending_bookings: not terminal (not completed, not cancelled)
-- -----------------------------------------------------------------------------

create view public.booking_stats as
select
  count(*)::bigint as total_bookings,
  count(*) filter (where status = 'completed'::public.booking_status)::bigint as completed_bookings,
  count(*) filter (where status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status))::bigint
    as pending_bookings
from public.bookings;

comment on view public.booking_stats is
  'Counts bookings by lifecycle; non-admin roles see counts only for rows visible via bookings RLS.';

-- -----------------------------------------------------------------------------
-- revenue_stats - single row (daily breakdown in Asia/Kolkata calendar days)
-- Revenue = successful dummy-gateway payments (amount in smallest currency unit).
-- -----------------------------------------------------------------------------

create view public.revenue_stats as
select
  coalesce(
    (select sum(p.amount)::bigint from public.payments p where p.status = 'success'::public.payment_status),
    0::bigint
  ) as total_revenue_cents,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'revenue_cents', d.revenue_cents
        )
        order by d.day
      )
      from (
        select
          ((p.created_at at time zone 'Asia/Kolkata')::date) as day,
          sum(p.amount)::bigint as revenue_cents
        from public.payments p
        where p.status = 'success'::public.payment_status
        group by 1
      ) d
    ),
    '[]'::jsonb
  ) as revenue_per_day;

comment on view public.revenue_stats is
  'total_revenue_cents and revenue_per_day JSON array; payment visibility follows payments RLS.';

-- -----------------------------------------------------------------------------
-- vendor_stats - per vendor
-- acceptance_rate: among vendor-visible paid pipeline jobs, share that reached accepted or beyond
-- completion_rate: among accepted/in_progress/completed, share that finished completed
-- -----------------------------------------------------------------------------

create view public.vendor_stats as
select
  v.id as vendor_id,
  count(b.id)::bigint as total_jobs,
  case
    when count(b.id) filter (
      where b.status in (
        'confirmed'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status,
        'cancelled'::public.booking_status
      )
    ) = 0
    then null::numeric
    else round(
      (
        count(b.id) filter (
          where b.status in (
            'accepted'::public.booking_status,
            'in_progress'::public.booking_status,
            'completed'::public.booking_status
          )
        )::numeric
        / nullif(
          count(b.id) filter (
            where b.status in (
              'confirmed'::public.booking_status,
              'accepted'::public.booking_status,
              'in_progress'::public.booking_status,
              'completed'::public.booking_status,
              'cancelled'::public.booking_status
            )
          )::numeric,
          0::numeric
        )
      ),
      6
    )
  end as acceptance_rate,
  case
    when count(b.id) filter (
      where b.status in (
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status
      )
    ) = 0
    then null::numeric
    else round(
      (
        count(b.id) filter (where b.status = 'completed'::public.booking_status)::numeric
        / nullif(
          count(b.id) filter (
            where b.status in (
              'accepted'::public.booking_status,
              'in_progress'::public.booking_status,
              'completed'::public.booking_status
            )
          )::numeric,
          0::numeric
        )
      ),
      6
    )
  end as completion_rate
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
group by v.id;

comment on view public.vendor_stats is
  'Per-vendor job counts and rates; booking visibility follows bookings RLS (vendors see own stats).';

-- -----------------------------------------------------------------------------
-- subscription_stats - single row
-- upcoming_services: future-dated subscription visits not completed/cancelled
-- -----------------------------------------------------------------------------

create view public.subscription_stats as
select
  (
    select count(*)::bigint
    from public.subscriptions s
    where s.status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
      and s.ends_at > now()
  ) as active_subscriptions,
  (
    select count(*)::bigint
    from public.bookings bk
    where bk.subscription_id is not null
      and (bk.scheduled_start at time zone 'Asia/Kolkata')::date
        >= (now() at time zone 'Asia/Kolkata')::date
      and bk.status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status)
  ) as upcoming_services;

comment on view public.subscription_stats is
  'Active AMC rows and count of upcoming subscription-linked bookings; respects RLS on underlying tables.';

grant select on public.booking_stats to authenticated;
grant select on public.revenue_stats to authenticated;
grant select on public.vendor_stats to authenticated;
grant select on public.subscription_stats to authenticated;
