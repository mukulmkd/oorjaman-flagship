-- Attribute completed/accepted bookings to vendors even when bookings.vendor_id was not set
-- (e.g. marketplace claim metadata only, vendor accept without column update, or seed re-create).
-- Backfill column from assigned technician, then aggregate via coalesce(vendor_id, technician.vendor_id).

update public.bookings b
set vendor_id = t.vendor_id
from public.technicians t
where b.vendor_id is null
  and b.technician_id = t.id
  and t.vendor_id is not null;

drop function if exists public.get_vendor_public_stats(uuid[]);

drop view if exists public.vendor_stats;

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
left join public.bookings b
  on coalesce(
    b.vendor_id,
    (select t.vendor_id from public.technicians t where t.id = b.technician_id limit 1)
  ) = v.id
left join public.job_reports jr on jr.booking_id = b.id
group by v.id;

comment on view public.vendor_stats is
  'Per-vendor metrics for admin/vendor; respects bookings RLS. Customers: use get_vendor_public_stats().';

grant select on public.vendor_stats to authenticated;

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
  left join public.bookings b
    on coalesce(
      b.vendor_id,
      (select t.vendor_id from public.technicians t where t.id = b.technician_id limit 1)
    ) = v.id
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
