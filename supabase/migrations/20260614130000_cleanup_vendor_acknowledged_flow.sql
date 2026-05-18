-- Cleanup migration for legacy vendor_acknowledged pipeline.
-- New flow is direct: confirmed -> accepted (with vendor technician assignment).
-- Runs after booking_status enum includes vendor_acknowledged.

-- 1) Backfill legacy rows so current UI/API no longer depends on vendor_acknowledged.
-- If a technician is already assigned, treat as accepted; otherwise move back to confirmed.
update public.bookings
set
  status = case
    when technician_id is not null then 'accepted'::public.booking_status
    else 'confirmed'::public.booking_status
  end,
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{vendor_acceptance,migrated_from_vendor_acknowledged}',
    'true'::jsonb,
    true
  ),
  updated_at = now()
where status = 'vendor_acknowledged'::public.booking_status;

-- 2) Keep vendor_stats aligned with direct acceptance flow.
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
  end as completion_rate
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
group by v.id;

comment on view public.vendor_stats is
  'Per-vendor job counts and rates; booking visibility follows bookings RLS (vendors see own stats).';

grant select on public.vendor_stats to authenticated;
