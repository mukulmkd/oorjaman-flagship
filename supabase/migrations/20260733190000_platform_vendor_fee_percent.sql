-- Partner visit payout: platform commission % (stored on settlement rows at creation time).

alter table public.platform_settings
  add column if not exists vendor_platform_fee_percent numeric(5, 2) not null default 10
  check (
    vendor_platform_fee_percent >= 0
    and vendor_platform_fee_percent <= 100
  );

comment on column public.platform_settings.vendor_platform_fee_percent is
  'OorjaMan commission on completed visit gross (INR paise). Applied when creating visit_payout settlement rows.';
