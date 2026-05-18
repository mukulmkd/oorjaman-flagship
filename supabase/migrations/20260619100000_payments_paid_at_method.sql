-- Customer-visible payment metadata (Indian checkout UX: method + paid-at).
alter table public.payments
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz;

comment on column public.payments.payment_method is 'Display label or short code for channel (e.g. UPI, Net banking).';
comment on column public.payments.paid_at is 'When the payment succeeded (IST-friendly display in apps).';

update public.payments
set paid_at = coalesce(paid_at, created_at)
where status = 'success'::public.payment_status
  and paid_at is null;
