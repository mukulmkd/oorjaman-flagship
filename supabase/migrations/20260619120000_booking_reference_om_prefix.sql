-- Shorter customer-facing booking reference: OM- + 8 hex (from UUID body, still unique via randomness + unique index).
alter table public.bookings
  alter column reference_code set default (
    'OM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

comment on column public.bookings.reference_code is 'Customer-facing booking id (OM-…). Unique. Vendor visit code remains booking_code (VIS-…).';
