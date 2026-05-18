-- Daily booking volume for trend charts (IST calendar days).

drop view if exists public.bookings_created_daily;

create view public.bookings_created_daily as
select
  (b.created_at at time zone 'Asia/Kolkata')::date as day,
  count(*)::bigint as booking_count
from public.bookings b
group by 1;

comment on view public.bookings_created_daily is
  'Bookings created per calendar day (Asia/Kolkata); respects bookings RLS.';

grant select on public.bookings_created_daily to authenticated;
