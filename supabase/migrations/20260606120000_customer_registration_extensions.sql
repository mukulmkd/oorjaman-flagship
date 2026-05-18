-- Customer registration (backlog): alternate phone, installation category, roof material,
-- last cleaning, structured consents in metadata.

alter table public.customers
  add column if not exists alternate_phone text,
  add column if not exists installation_category text,
  add column if not exists last_cleaning_at date,
  add column if not exists solar_roof_material text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.customers
  drop constraint if exists customers_installation_category_check;

alter table public.customers
  add constraint customers_installation_category_check
  check (installation_category is null or installation_category in ('residential', 'commercial'));

alter table public.customers
  drop constraint if exists customers_solar_roof_material_check;

alter table public.customers
  add constraint customers_solar_roof_material_check
  check (solar_roof_material is null or solar_roof_material in ('tin_metal', 'rcc', 'mixed', 'other'));
