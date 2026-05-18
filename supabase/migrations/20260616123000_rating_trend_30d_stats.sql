drop view if exists public.technician_stats;
drop view if exists public.vendor_stats;

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
  end as completion_rate,
  round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
  round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
  count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
left join public.job_reports jr on jr.booking_id = b.id
group by v.id;

create view public.technician_stats as
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

grant select on public.vendor_stats to authenticated;
grant select on public.technician_stats to authenticated;
