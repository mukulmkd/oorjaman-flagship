-- Customer profile: site address, GPS, solar installation, safety; onboarding completion gate.

alter table public.customers add column if not exists contact_email text;
alter table public.customers add column if not exists service_lat double precision;
alter table public.customers add column if not exists service_lng double precision;
alter table public.customers add column if not exists location_accuracy_m double precision;
alter table public.customers add column if not exists location_recorded_at timestamptz;
alter table public.customers add column if not exists solar_capacity_kw numeric(10, 2);
alter table public.customers add column if not exists solar_panel_count integer;
alter table public.customers add column if not exists solar_roof_type text;
alter table public.customers add column if not exists safety_roof_access text;
alter table public.customers add column if not exists safety_water_availability text;
alter table public.customers add column if not exists safety_hazards text;
alter table public.customers add column if not exists onboarding_completed_at timestamptz;

-- Existing rows: treat as already onboarded so current users are not blocked.
update public.customers
set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;
