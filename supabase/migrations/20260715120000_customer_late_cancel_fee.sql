-- Configurable late customer-cancellation fee (INR paise, same unit as estimated_price_cents on bookings).

alter table public.platform_settings
  add column if not exists customer_late_cancel_fee_paise integer not null default 9900
    check (customer_late_cancel_fee_paise >= 0 and customer_late_cancel_fee_paise <= 1000000000);

comment on column public.platform_settings.customer_late_cancel_fee_paise is
  'INR paise applied when a customer cancels after the grace window (typically charged or netted at refund time by ops).';
