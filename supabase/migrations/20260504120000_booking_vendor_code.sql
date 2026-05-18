-- Short code assigned when vendor accepts (VIS-…); distinct from reference_code (BK-…).
alter table public.bookings add column if not exists booking_code text;

create unique index if not exists bookings_booking_code_key on public.bookings (booking_code)
  where booking_code is not null;

comment on column public.bookings.booking_code is 'Vendor acceptance code (VIS-…). Set when the vendor accepts the request.';
