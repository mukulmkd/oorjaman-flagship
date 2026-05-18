-- Analytics views: use security_invoker so RLS on underlying tables applies to the querying user.
-- Fixes Supabase linter "SECURITY DEFINER view" findings.
--
-- Admin dashboards: is_admin() RLS sees platform-wide aggregates.
-- Vendors / technicians: see only rows visible via bookings RLS.
-- Customers: marketplace vendor ratings use get_vendor_public_stats() (controlled definer RPC).

drop function if exists public.get_vendor_public_stats(uuid[]);

drop view if exists public.bookings_created_daily;
drop view if exists public.subscription_stats;
drop view if exists public.technician_stats;
drop view if exists public.vendor_stats;
drop view if exists public.revenue_stats;
drop view if exists public.booking_stats;

create view public.booking_stats
with (security_invoker = true) as
select
  count(*)::bigint as total_bookings,
  count(*) filter (where status = 'completed'::public.booking_status)::bigint as completed_bookings,
  count(*) filter (where status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status))::bigint
    as pending_bookings
from public.bookings;

create view public.revenue_stats
with (security_invoker = true) as
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

create view public.vendor_stats
with (security_invoker = true) as
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
  end as completion_rate,
  round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
  round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
  count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
left join public.job_reports jr on jr.booking_id = b.id
group by v.id;

create view public.technician_stats
with (security_invoker = true) as
select
  t.id as technician_id,
  count(b.id)::bigint as total_jobs,
  round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
  round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
  count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
from public.technicians t
left join public.bookings b on b.technician_id = t.id
left join public.job_reports jr on jr.booking_id = b.id
group by t.id;

create view public.subscription_stats
with (security_invoker = true) as
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

create view public.bookings_created_daily
with (security_invoker = true) as
select
  (b.created_at at time zone 'Asia/Kolkata')::date as day,
  count(*)::bigint as booking_count
from public.bookings b
group by 1;

comment on view public.booking_stats is
  'Booking lifecycle counts; respects bookings RLS (admin = platform totals).';
comment on view public.revenue_stats is
  'Payment revenue totals; respects payments RLS.';
comment on view public.vendor_stats is
  'Per-vendor metrics for admin/vendor; respects bookings RLS. Customers: use get_vendor_public_stats().';
comment on view public.technician_stats is
  'Per-technician metrics; respects bookings/job_reports RLS.';
comment on view public.subscription_stats is
  'AMC and upcoming subscription visits; respects subscriptions/bookings RLS.';
comment on view public.bookings_created_daily is
  'Daily booking volume (Asia/Kolkata); respects bookings RLS.';

grant select on public.booking_stats to authenticated;
grant select on public.revenue_stats to authenticated;
grant select on public.vendor_stats to authenticated;
grant select on public.technician_stats to authenticated;
grant select on public.subscription_stats to authenticated;
grant select on public.bookings_created_daily to authenticated;

-- Marketplace: platform-wide aggregates for approved vendors only (no booking-level PII).
create or replace function public.get_vendor_public_stats(p_vendor_ids uuid[] default null)
returns table (
  vendor_id uuid,
  total_jobs bigint,
  acceptance_rate numeric,
  completion_rate numeric,
  avg_rating numeric,
  rating_count bigint,
  avg_rating_30d numeric,
  rating_count_30d bigint
)
language sql
stable
security definer
set search_path = public
as $$
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
    end as completion_rate,
    round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
    count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
    round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
    count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
  from public.vendors v
  left join public.bookings b on b.vendor_id = v.id
  left join public.job_reports jr on jr.booking_id = b.id
  where (
    public.is_admin()
    or v.approval_status = 'approved'::public.vendor_approval_status
  )
    and (p_vendor_ids is null or cardinality(p_vendor_ids) = 0 or v.id = any(p_vendor_ids))
  group by v.id;
$$;

comment on function public.get_vendor_public_stats(uuid[]) is
  'Public vendor rating/job aggregates for marketplace (approved vendors). Admins may pass any vendor ids.';

grant execute on function public.get_vendor_public_stats(uuid[]) to authenticated;
