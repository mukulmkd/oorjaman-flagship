-- Add-on amounts (INR paise / "cents" column naming) applied on top of fixed catalogue
-- (one-time visit + AMC plan) when the customer's city maps to this geo pricing tier.

alter table public.pricing_tiers
  add column if not exists visit_addon_cents integer not null default 0
    check (visit_addon_cents >= 0 and visit_addon_cents <= 1000000000),
  add column if not exists amc_addon_cents integer not null default 0
    check (amc_addon_cents >= 0 and amc_addon_cents <= 1000000000);

comment on column public.pricing_tiers.visit_addon_cents is
  'Flat INR add-on (same unit as amount_cents) added to one-time visit catalogue price when city maps to this tier.';
comment on column public.pricing_tiers.amc_addon_cents is
  'Flat INR add-on added to AMC catalogue plan price when subscription service address city maps to this tier.';
