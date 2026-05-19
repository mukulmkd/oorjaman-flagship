-- =============================================================================
-- OorjaManDB - full public schema (Supabase / PostgreSQL)
-- Project: OorjaManDB
-- Apply via: Supabase SQL editor, `supabase db push`, or migration tooling.
-- Requires: Supabase Auth (`auth.users`)
--
-- Idempotent: safe to re-run on an existing database with the same definitions
-- (enums via DO/duplicate_object; IF NOT EXISTS on tables/indexes; DROP+CREATE triggers).
-- Apply policies.sql after this file for RLS and helper functions such as is_admin().
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums (DO blocks: CREATE TYPE ... IF NOT EXISTS is not available on all PG versions)
-- -----------------------------------------------------------------------------

do $enum$
begin
  create type public.user_role as enum (
    'customer',
    'vendor',
    'technician',
    'admin'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.vendor_approval_status as enum (
    'pending',
    'under_review',
    'approved',
    'rejected',
    'suspended'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.booking_status as enum (
    'pending_payment',
    'confirmed',
    'vendor_acknowledged',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.subscription_status as enum (
    'trialing',
    'active',
    'paused',
    'cancelled',
    'expired',
    'past_due'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.subscription_billing_period as enum (
    'monthly',
    'quarterly',
    'annual',
    'custom'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.job_report_weather as enum (
    'clear',
    'cloudy',
    'windy',
    'rain',
    'other'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.technician_verification_status as enum (
    'pending_review',
    'verified',
    'rejected'
  );
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'technician_verification_status'
      and e.enumlabel = 'draft'
  ) then
    alter type public.technician_verification_status add value 'draft';
  end if;
end $enum$;

do $enum$
begin
  create type public.payment_status as enum ('pending', 'success', 'failed');
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.vendor_technician_invite_status as enum (
    'invited',
    'opened',
    'completed',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $enum$;

-- -----------------------------------------------------------------------------
-- Timestamps helper
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users - one row per Supabase auth user; primary application role
-- -----------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  avatar_url text,
  locale text default 'en-IN',
  timezone text default 'Asia/Kolkata',
  is_active boolean not null default true,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_lowercase check (email is null or email = lower(trim(email)))
);

create unique index if not exists users_phone_unique_idx
  on public.users (phone)
  where phone is not null;

create index if not exists users_role_idx on public.users (role);
create index if not exists users_created_at_idx on public.users (created_at desc);
create index if not exists users_is_active_idx on public.users (is_active)
  where is_active = true;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Role-extension validation (cannot use subqueries in CHECK constraints)
-- -----------------------------------------------------------------------------

create or replace function public.assert_user_role_extension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  -- SECURITY DEFINER: vendors updating technicians must validate role without
  -- being blocked by users RLS (select self or admin only).
  select u.role into r from public.users u where u.id = new.user_id;
  if r is null then
    raise exception 'users row missing for user_id %', new.user_id;
  end if;
  if tg_table_name = 'customers' and r <> 'customer'::public.user_role then
    raise exception 'customers.user_id must reference users.role = customer';
  end if;
  if tg_table_name = 'vendors' and r <> 'vendor'::public.user_role then
    raise exception 'vendors.user_id must reference users.role = vendor';
  end if;
  if tg_table_name = 'technicians' and r <> 'technician'::public.user_role then
    raise exception 'technicians.user_id must reference users.role = technician';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text,
  contact_email text,
  alternate_phone text,
  billing_address jsonb,
  service_default_address jsonb,
  notes text,
  service_lat double precision,
  service_lng double precision,
  location_accuracy_m double precision,
  location_recorded_at timestamptz,
  solar_capacity_kw numeric(10, 2),
  solar_panel_count integer,
  installation_category text,
  solar_roof_type text,
  solar_roof_material text,
  last_cleaning_at date,
  safety_roof_access text,
  safety_water_availability text,
  safety_hazards text,
  -- Partner prefs (among other keys): fallback_vendor_id, service_addresses[].preferred_vendor_ids,
  -- service_addresses[].site_photos (geo-tagged gallery, Storage bucket customer-site-photos), default_service_address_id.
  metadata jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_installation_category_check
    check (installation_category is null or installation_category in ('residential', 'commercial')),
  constraint customers_solar_roof_material_check
    check (solar_roof_material is null or solar_roof_material in ('tin_metal', 'rcc', 'mixed', 'other'))
);

create index if not exists customers_user_id_idx on public.customers (user_id);

drop trigger if exists customers_assert_role on public.customers;
create trigger customers_assert_role
before insert or update on public.customers
for each row execute function public.assert_user_role_extension();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- vendors - approval workflow for vendor organisations
-- -----------------------------------------------------------------------------

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  business_name text not null,
  trade_name text,
  gstin text,
  pan text,
  approval_status public.vendor_approval_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  rejection_reason text,
  contact_email text,
  contact_phone text,
  registered_address jsonb,
  operating_regions text[],
  bank_detail_last4 text,
  company_type text,
  company_registration_number text,
  website_url text,
  contact_person_name text,
  contact_person_role text,
  contact_person_phone text,
  contact_person_email text,
  service_areas text[],
  experience_summary text,
  years_in_business numeric(6, 1),
  equipment_available text[],
  flag_safety_training boolean not null default false,
  flag_ppe_available boolean not null default false,
  flag_insurance_coverage boolean not null default false,
  doc_pan_url text,
  doc_aadhaar_url text,
  doc_gst_url text,
  doc_bank_proof_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_rejection_when_rejected
    check (
      approval_status <> 'rejected'
      or (rejection_reason is not null and btrim(rejection_reason) <> '')
    ),
  constraint vendors_approved_timestamps
    check (
      approval_status <> 'approved'
      or (approved_at is not null and reviewed_at is not null)
    )
);

create index if not exists vendors_approval_status_idx on public.vendors (approval_status);
create index if not exists vendors_created_at_idx on public.vendors (created_at desc);
create index if not exists vendors_user_id_idx on public.vendors (user_id);

drop trigger if exists vendors_assert_role on public.vendors;
create trigger vendors_assert_role
before insert or update on public.vendors
for each row execute function public.assert_user_role_extension();

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

-- Vendors cannot self-approve; may only move rejected → pending when re-applying.
create or replace function public.vendors_guard_approval_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if old.approval_status = 'rejected'::public.vendor_approval_status
     and new.approval_status = 'pending'::public.vendor_approval_status then
    new.reviewed_at := null;
    new.approved_at := null;
    new.approved_by := null;
    new.rejection_reason := null;
    return new;
  end if;
  if new.approval_status is distinct from old.approval_status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Not allowed to change approval or review fields';
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_guard_approval_writes on public.vendors;
create trigger vendors_guard_approval_writes
before update on public.vendors
for each row execute function public.vendors_guard_approval_writes();

-- -----------------------------------------------------------------------------
-- platform_settings - singleton (id=1) ops defaults
-- -----------------------------------------------------------------------------

create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  default_vendor_id uuid references public.vendors (id) on delete set null,
  customer_late_cancel_fee_paise int not null default 9900
    check (customer_late_cancel_fee_paise >= 0 and customer_late_cancel_fee_paise <= 1000000000),
  vendor_platform_fee_percent numeric(5, 2) not null default 10
    check (vendor_platform_fee_percent >= 0 and vendor_platform_fee_percent <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Country-scoped pricing tiers + city maps + rules (INR paise national default, tier rates, legacy city rows)
-- -----------------------------------------------------------------------------

create table if not exists public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'IN'
    check (length(trim(country_code)) >= 2 and length(trim(country_code)) <= 3),
  code text not null check (length(trim(code)) > 0),
  label text not null,
  sort_order int not null default 0,
  visit_addon_cents int not null default 0 check (visit_addon_cents >= 0 and visit_addon_cents <= 1000000000),
  amc_addon_cents int not null default 0 check (amc_addon_cents >= 0 and amc_addon_cents <= 1000000000),
  created_at timestamptz not null default now(),
  unique (country_code, code)
);

create table if not exists public.pricing_city_tiers (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'IN'
    check (length(trim(country_code)) >= 2 and length(trim(country_code)) <= 3),
  city_key text not null check (length(trim(city_key)) > 0),
  state_key text,
  tier_code text not null,
  created_at timestamptz not null default now(),
  unique (country_code, city_key),
  constraint pricing_city_tiers_tier_fk
    foreign key (country_code, tier_code)
    references public.pricing_tiers (country_code, code)
    on delete restrict
);

create index if not exists pricing_city_tiers_country_idx on public.pricing_city_tiers (country_code);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'IN',
  city text,
  tier_code text,
  base_price bigint not null default 0 check (base_price >= 0),
  per_panel_rate bigint not null default 0 check (per_panel_rate >= 0),
  per_kw_rate bigint not null default 0 check (per_kw_rate >= 0),
  multiplier numeric(10, 4) not null default 1.0 check (multiplier > 0),
  created_at timestamptz not null default now(),
  constraint pricing_rules_city_nonempty check (city is null or length(trim(city)) > 0),
  constraint pricing_rules_tier_exclusive_city check (tier_code is null or city is null),
  constraint pricing_rules_tier_fk
    foreign key (country_code, tier_code)
    references public.pricing_tiers (country_code, code)
    on delete restrict
);

create unique index if not exists pricing_rules_national_default_uq on public.pricing_rules (country_code)
where city is null and tier_code is null;

create unique index if not exists pricing_rules_tier_rate_uq
  on public.pricing_rules (country_code, lower(trim(tier_code)))
  where tier_code is not null and city is null;

create unique index if not exists pricing_rules_legacy_city_uq
  on public.pricing_rules (country_code, lower(trim(city)))
  where city is not null and tier_code is null;

insert into public.pricing_tiers (country_code, code, label, sort_order)
values
  ('IN', 'tier_1_metro', 'Tier 1 - Metro', 10),
  ('IN', 'tier_2_city', 'Tier 2 - City', 20),
  ('IN', 'tier_3_town', 'Tier 3 - Town', 30),
  ('IN', 'tier_other', 'Tier - Other India', 40)
on conflict (country_code, code) do nothing;

insert into public.pricing_rules (country_code, city, tier_code, base_price, per_panel_rate, per_kw_rate, multiplier)
select 'IN'::text, null::text, null::text, 0, 0, 0, 1.0
where not exists (
  select 1 from public.pricing_rules pr where pr.country_code = 'IN' and pr.city is null and pr.tier_code is null
);

create table if not exists public.pricing_national_default_audit (
  id uuid primary key default gen_random_uuid(),
  pricing_rule_id uuid,
  country_code text not null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  old_snapshot jsonb,
  new_snapshot jsonb,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists pricing_national_default_audit_country_changed_idx
  on public.pricing_national_default_audit (country_code, changed_at desc);

-- -----------------------------------------------------------------------------
-- Service capacity pricing (fixed kW tiers: one-time visit + AMC catalog)
-- -----------------------------------------------------------------------------

create table if not exists public.service_capacity_tiers (
  country_code char(2) not null default 'IN',
  code text not null,
  capacity_kw numeric(6, 2) not null check (capacity_kw > 0),
  typical_panel_count integer not null check (typical_panel_count > 0),
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (country_code, code),
  constraint service_capacity_tiers_code_format check (code ~ '^[a-z0-9_]+$')
);

create table if not exists public.pricing_one_time_rates (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null default 'IN',
  capacity_tier_code text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  per_panel_rate_cents bigint not null default 10000 check (per_panel_rate_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_one_time_rates_tier_fk
    foreign key (country_code, capacity_tier_code)
    references public.service_capacity_tiers (country_code, code)
    on delete restrict,
  constraint pricing_one_time_rates_unique unique (country_code, capacity_tier_code)
);

create table if not exists public.pricing_amc_plans (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null default 'IN',
  capacity_tier_code text not null,
  plan_code text not null,
  plan_name text not null,
  contract_months integer not null check (contract_months in (12, 24)),
  visits_included integer not null check (visits_included > 0),
  visits_per_year integer,
  amount_cents bigint not null check (amount_cents >= 0),
  billing_period public.subscription_billing_period not null default 'custom',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_amc_plans_tier_fk
    foreign key (country_code, capacity_tier_code)
    references public.service_capacity_tiers (country_code, code)
    on delete restrict,
  constraint pricing_amc_plans_plan_code_unique unique (plan_code),
  constraint pricing_amc_plans_unique_variant
    unique (country_code, capacity_tier_code, contract_months, visits_included)
);

create table if not exists public.pricing_catalog_audit (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name in ('pricing_one_time_rates', 'pricing_amc_plans')),
  record_id uuid not null,
  country_code char(2) not null default 'IN',
  operation text not null check (operation in ('insert', 'update', 'delete')),
  old_snapshot jsonb,
  new_snapshot jsonb,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists pricing_catalog_audit_country_changed_idx
  on public.pricing_catalog_audit (country_code, changed_at desc);

create index if not exists pricing_amc_plans_country_tier_idx
  on public.pricing_amc_plans (country_code, capacity_tier_code, sort_order);

-- -----------------------------------------------------------------------------
-- technicians - optional employment under a vendor
-- -----------------------------------------------------------------------------

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete set null,
  employee_code text unique,
  skills text[] not null default '{}'::text[],
  service_radius_km numeric(8, 2),
  home_base_address jsonb,
  is_verified boolean not null default false,
  is_available boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  verification_status public.technician_verification_status not null default 'pending_review',
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_rejection_reason text,
  date_of_birth date,
  personal_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  aadhaar_last4 text,
  pan_number text,
  doc_aadhaar_url text,
  doc_pan_url text,
  experience_summary text,
  years_experience numeric(6, 1),
  flag_safety_training boolean not null default false,
  flag_height_work_cert boolean not null default false,
  bank_account_holder_name text,
  bank_account_last4 text,
  bank_ifsc text,
  doc_bank_proof_url text,
  preferred_work_locations text[],
  father_guardian_name text,
  gender text,
  contact_email text,
  name_as_per_aadhaar text,
  safety_training_org text,
  doc_passport_url text,
  doc_safety_certificate_url text,
  flag_solar_cleaning_experience boolean not null default false,
  other_skills text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technicians_gender_chk check (
    gender is null
    or gender in ('female', 'male', 'other', 'prefer_not_to_say')
  )
);

create index if not exists technicians_vendor_id_idx on public.technicians (vendor_id)
  where vendor_id is not null;
create index if not exists technicians_user_id_idx on public.technicians (user_id);
create index if not exists technicians_available_idx on public.technicians (is_available)
  where is_available = true;

create index if not exists technicians_verification_status_idx on public.technicians (verification_status);

alter table public.technicians
  add column if not exists vendor_review_status text not null default 'pending';

alter table public.technicians
  add column if not exists vendor_reviewed_at timestamptz;

alter table public.technicians
  add column if not exists vendor_rejection_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'technicians_vendor_review_status_chk'
  ) then
    alter table public.technicians
      add constraint technicians_vendor_review_status_chk
      check (vendor_review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

drop trigger if exists technicians_assert_role on public.technicians;
create trigger technicians_assert_role
before insert or update on public.technicians
for each row execute function public.assert_user_role_extension();

drop trigger if exists technicians_set_updated_at on public.technicians;
create trigger technicians_set_updated_at
before update on public.technicians
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- vendor_technician_invites - vendor-owned invite records for technician onboarding
-- -----------------------------------------------------------------------------

create table if not exists public.vendor_technician_invites (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  invited_by_user_id uuid not null references public.users (id) on delete cascade,
  full_name text,
  invite_phone_e164 text not null,
  invite_email text,
  invite_token text not null unique,
  invite_url text,
  status public.vendor_technician_invite_status not null default 'invited',
  notification_channels text[] not null default '{}'::text[],
  invited_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,
  last_notified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_technician_invites_vendor_id_idx
  on public.vendor_technician_invites (vendor_id);

create index if not exists vendor_technician_invites_phone_idx
  on public.vendor_technician_invites (invite_phone_e164);

drop trigger if exists vendor_technician_invites_set_updated_at on public.vendor_technician_invites;
create trigger vendor_technician_invites_set_updated_at
before update on public.vendor_technician_invites
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- vendor_slot_availability - vendor-managed slot-level availability/capacity
-- -----------------------------------------------------------------------------

create table if not exists public.vendor_slot_availability (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  day_key date not null,
  slot_id text not null,
  is_available boolean not null default true,
  capacity smallint not null default 1 check (capacity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (vendor_id, day_key, slot_id)
);

create index if not exists vendor_slot_availability_vendor_day_idx
  on public.vendor_slot_availability (vendor_id, day_key);

drop trigger if exists vendor_slot_availability_set_updated_at on public.vendor_slot_availability;
create trigger vendor_slot_availability_set_updated_at
before update on public.vendor_slot_availability
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- notification_events - auditable queue/log for async outbound notifications
-- -----------------------------------------------------------------------------

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  recipient_audience text not null default 'vendor'
    check (recipient_audience in ('admin', 'vendor')),
  recipient_vendor_id uuid references public.vendors (id) on delete cascade,
  read_at timestamptz,
  event_type text not null,
  channels jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  demo_mode boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_booking_idx
  on public.notification_events (booking_id, created_at desc);
create index if not exists notification_events_vendor_idx
  on public.notification_events (recipient_vendor_id, created_at desc);
create index if not exists notification_events_status_idx
  on public.notification_events (status, created_at desc);
create index if not exists notification_events_retry_idx
  on public.notification_events (status, next_attempt_at, created_at);

-- -----------------------------------------------------------------------------
-- notification_templates - channel copy managed separately from event queue
-- -----------------------------------------------------------------------------

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  template_key text not null,
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel, template_key)
);

create index if not exists notification_templates_event_channel_idx
  on public.notification_templates (event_type, channel, is_active);

drop trigger if exists notification_templates_set_updated_at on public.notification_templates;
create trigger notification_templates_set_updated_at
before update on public.notification_templates
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- notification_channel_settings - enable/disable by event/channel per mode
-- -----------------------------------------------------------------------------

create table if not exists public.notification_channel_settings (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  enabled_demo boolean not null default true,
  enabled_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel)
);

create index if not exists notification_channel_settings_event_channel_idx
  on public.notification_channel_settings (event_type, channel);

drop trigger if exists notification_channel_settings_set_updated_at on public.notification_channel_settings;
create trigger notification_channel_settings_set_updated_at
before update on public.notification_channel_settings
for each row execute function public.set_updated_at();

create or replace function public.technicians_normalize_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.is_verified := false;
  if new.verification_status = 'draft'::public.technician_verification_status then
    return new;
  end if;
  new.verification_status := 'pending_review'::public.technician_verification_status;
  return new;
end;
$$;

drop trigger if exists technicians_normalize_insert on public.technicians;
create trigger technicians_normalize_insert
before insert on public.technicians
for each row execute function public.technicians_normalize_insert();

create or replace function public.generate_technician_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  tries int := 0;
begin
  loop
    tries := tries + 1;
    if tries > 24 then
      raise exception 'could not allocate technician employee_code';
    end if;
    code := 'OMT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1 from public.technicians t where t.employee_code = code
    );
  end loop;
  return code;
end;
$$;

grant execute on function public.generate_technician_employee_code() to authenticated;

create or replace function public.technicians_finalize_vendor_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.vendor_review_status = 'approved'
     and coalesce(old.vendor_review_status, 'pending') <> 'approved'
     and public.is_approved_vendor_user()
     and new.vendor_id is not null
     and new.vendor_id = public.my_vendor_id() then
    new.verification_status := 'verified'::public.technician_verification_status;
    new.is_verified := true;
    new.verification_reviewed_at := coalesce(new.verification_reviewed_at, now());
    new.verification_rejection_reason := null;
    if new.employee_code is null or trim(new.employee_code) = '' then
      new.employee_code := public.generate_technician_employee_code();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists technicians_finalize_vendor_approval on public.technicians;
create trigger technicians_finalize_vendor_approval
before update on public.technicians
for each row execute function public.technicians_finalize_vendor_approval();

create or replace function public.technicians_guard_vendor_review_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.vendor_review_status is distinct from old.vendor_review_status
     or new.vendor_reviewed_at is distinct from old.vendor_reviewed_at
     or new.vendor_rejection_reason is distinct from old.vendor_rejection_reason then
    if public.is_admin() then
      return new;
    end if;
    if public.is_approved_vendor_user()
       and new.vendor_id is not null
       and new.vendor_id = public.my_vendor_id() then
      return new;
    end if;
    raise exception 'Not allowed to change vendor review fields';
  end if;
  return new;
end;
$$;

drop trigger if exists technicians_guard_vendor_review_writes on public.technicians;
create trigger technicians_guard_vendor_review_writes
before update on public.technicians
for each row execute function public.technicians_guard_vendor_review_writes();

create or replace function public.technicians_guard_verification_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if old.verification_status = 'rejected'::public.technician_verification_status
     and new.verification_status = 'pending_review'::public.technician_verification_status then
    new.verification_rejection_reason := null;
    new.verification_reviewed_at := null;
    return new;
  end if;
  if old.verification_status = 'draft'::public.technician_verification_status
     and new.verification_status = 'pending_review'::public.technician_verification_status then
    return new;
  end if;
  if coalesce(old.vendor_review_status, 'pending') <> 'approved'
     and new.vendor_review_status = 'approved'
     and public.is_approved_vendor_user()
     and new.vendor_id is not null
     and new.vendor_id = public.my_vendor_id() then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.is_verified is distinct from old.is_verified
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Not allowed to change verification fields';
  end if;
  if new.employee_code is distinct from old.employee_code then
    raise exception 'Not allowed to change employee_code';
  end if;
  return new;
end;
$$;

drop trigger if exists technicians_guard_verification_writes on public.technicians;
create trigger technicians_guard_verification_writes
before update on public.technicians
for each row execute function public.technicians_guard_verification_writes();

-- -----------------------------------------------------------------------------
-- technician_locations - GPS samples (technician app; optional ops visibility)
-- -----------------------------------------------------------------------------

create table if not exists public.technician_locations (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now(),
  constraint technician_locations_lat_range check (lat >= -90::double precision and lat <= 90::double precision),
  constraint technician_locations_lng_range check (lng >= -180::double precision and lng <= 180::double precision)
);

create index if not exists technician_locations_technician_recorded_idx
  on public.technician_locations (technician_id, recorded_at desc);

-- -----------------------------------------------------------------------------
-- subscriptions - AMC / prepaid maintenance plans
-- -----------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  /** Saved address book entry id (`customers.metadata.service_addresses[].id`). */
  service_address_id text,
  plan_code text not null,
  plan_name text not null,
  status public.subscription_status not null default 'active',
  billing_period public.subscription_billing_period not null default 'annual',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visits_included integer,
  visits_used integer not null default 0 check (visits_used >= 0),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency char(3) not null default 'INR',
  renewal_reminder_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  external_provider text,
  external_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_period_order check (ends_at > starts_at),
  constraint subscriptions_visits_usage
    check (visits_included is null or visits_used <= visits_included)
);

create index if not exists subscriptions_customer_id_idx on public.subscriptions (customer_id);
create index if not exists subscriptions_service_address_id_idx on public.subscriptions (customer_id, service_address_id);
create unique index if not exists subscriptions_one_active_amc_per_address_idx
  on public.subscriptions (customer_id, service_address_id)
  where status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
    and service_address_id is not null
    and service_address_id <> '';
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_ends_at_idx on public.subscriptions (ends_at);
create unique index if not exists subscriptions_external_unique_idx
  on public.subscriptions (external_provider, external_subscription_id)
  where external_provider is not null and external_subscription_id is not null;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- bookings - scheduled visits (optionally linked to AMC subscription)
-- -----------------------------------------------------------------------------

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null
    unique
    default ('OM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  booking_code text,
  customer_id uuid not null references public.customers (id) on delete restrict,
  vendor_id uuid references public.vendors (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  status public.booking_status not null default 'pending_payment',
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  service_site_address jsonb not null,
  service_type text not null default 'panel_cleaning',
  estimated_price_cents bigint not null default 0 check (estimated_price_cents >= 0),
  final_price_cents bigint check (final_price_cents is null or final_price_cents >= 0),
  currency char(3) not null default 'INR',
  customer_notes text,
  internal_notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (scheduled_end > scheduled_start),
  constraint bookings_actual_time_order check (
    actual_start is null
    or actual_end is null
    or actual_end >= actual_start
  )
);

create unique index if not exists bookings_booking_code_key on public.bookings (booking_code)
  where booking_code is not null;

create index if not exists bookings_customer_id_idx on public.bookings (customer_id);
create index if not exists bookings_vendor_id_idx on public.bookings (vendor_id)
  where vendor_id is not null;
create index if not exists bookings_technician_id_idx on public.bookings (technician_id)
  where technician_id is not null;
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_scheduled_start_idx on public.bookings (scheduled_start);
create index if not exists bookings_customer_scheduled_idx on public.bookings (customer_id, scheduled_start desc);
create index if not exists bookings_subscription_id_idx on public.bookings (subscription_id)
  where subscription_id is not null;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- job_reports - post-visit completion reports (one canonical report per booking)
-- -----------------------------------------------------------------------------

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  completed_at timestamptz not null default now(),
  weather public.job_report_weather,
  panel_area_sqm numeric(12, 2),
  before_photo_urls jsonb not null default '[]'::jsonb,
  after_photo_urls jsonb not null default '[]'::jsonb,
  water_tds_ppm numeric(10, 2),
  debris_level text,
  anomaly_notes text,
  customer_rating integer check (
    customer_rating is null or (customer_rating >= 1 and customer_rating <= 5)
  ),
  customer_feedback text,
  feedback_hidden boolean not null default false,
  feedback_hidden_reason text,
  feedback_hidden_at timestamptz,
  feedback_hidden_by uuid references public.users (id) on delete set null,
  checklist jsonb not null default '{}'::jsonb,
  signed_off_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_reports_booking_id_idx on public.job_reports (booking_id);
create index if not exists job_reports_technician_id_idx on public.job_reports (technician_id)
  where technician_id is not null;
create index if not exists job_reports_completed_at_idx on public.job_reports (completed_at desc);
create index if not exists job_reports_feedback_hidden_idx
  on public.job_reports (feedback_hidden, completed_at desc);

drop trigger if exists job_reports_set_updated_at on public.job_reports;
create trigger job_reports_set_updated_at
before update on public.job_reports
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- payments - dummy checkout (INR paise; booking_id after success)
-- -----------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_customer_id_idx on public.payments (customer_id);
create index if not exists payments_booking_id_idx on public.payments (booking_id)
  where booking_id is not null;

-- -----------------------------------------------------------------------------
-- Auth bridge: create public.users when auth.users is created
-- -----------------------------------------------------------------------------

create or replace function public.coerce_user_role(raw text)
returns public.user_role
language plpgsql
immutable
as $$
begin
  return case lower(coalesce(raw, 'customer'))
    when 'customer' then 'customer'::public.user_role
    when 'vendor' then 'vendor'::public.user_role
    when 'technician' then 'technician'::public.user_role
    when 'admin' then 'admin'::public.user_role
    else 'customer'::public.user_role
  end;
end;
$$;

create or replace function public.guard_users_verification_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('oorjaman.auth_sync', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.phone_verified_at := old.phone_verified_at;
    new.email_verified_at := old.email_verified_at;
  else
    new.phone_verified_at := null;
    new.email_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_verification_columns on public.users;
create trigger users_guard_verification_columns
before insert or update on public.users
for each row execute function public.guard_users_verification_columns();

create or replace function public.auth_user_phone_e164(au auth.users)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(au.phone, au.raw_user_meta_data->>'phone', '')), '');
$$;

create or replace function public.auth_user_email_normalized(au auth.users)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(au.email, ''))), '');
$$;

create or replace function public.auth_user_full_name(au auth.users)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(au.raw_user_meta_data->>'full_name', '')), '');
$$;

create or replace function public.auth_user_role_from_metadata(au auth.users)
returns public.user_role
language plpgsql
immutable
as $$
declare
  raw text;
begin
  raw := nullif(trim(coalesce(au.raw_user_meta_data->>'role', '')), '');
  if raw is null then
    return null;
  end if;
  return public.coerce_user_role(raw);
end;
$$;

create or replace function public.auth_user_phone_verified_at(au auth.users)
returns timestamptz
language sql
immutable
as $$
  select au.phone_confirmed_at;
$$;

create or replace function public.auth_user_email_verified_at(au auth.users)
returns timestamptz
language sql
immutable
as $$
  select au.email_confirmed_at;
$$;

create or replace function public.apply_auth_user_to_public_users(au auth.users)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_phone text;
  v_full_name text;
  v_role public.user_role;
  v_phone_verified timestamptz;
  v_email_verified timestamptz;
begin
  v_email := public.auth_user_email_normalized(au);
  v_phone := public.auth_user_phone_e164(au);
  v_full_name := public.auth_user_full_name(au);
  v_role := public.auth_user_role_from_metadata(au);
  v_phone_verified := public.auth_user_phone_verified_at(au);
  v_email_verified := public.auth_user_email_verified_at(au);

  perform set_config('oorjaman.auth_sync', 'on', true);

  insert into public.users (
    id,
    email,
    full_name,
    phone,
    role,
    phone_verified_at,
    email_verified_at
  )
  values (
    au.id,
    v_email,
    v_full_name,
    v_phone,
    coalesce(v_role, 'customer'::public.user_role),
    v_phone_verified,
    v_email_verified
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.users.email),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    phone = coalesce(excluded.phone, public.users.phone),
    role = coalesce(v_role, public.users.role),
    phone_verified_at = coalesce(excluded.phone_verified_at, public.users.phone_verified_at),
    email_verified_at = coalesce(excluded.email_verified_at, public.users.email_verified_at),
    updated_at = now();

  perform set_config('oorjaman.auth_sync', 'off', true);
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.apply_auth_user_to_public_users(new);
  return new;
end;
$$;

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.apply_auth_user_to_public_users(new);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_updated();

create or replace function public.sync_my_user_from_auth()
returns public.users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  au auth.users;
  row public.users;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into au from auth.users where id = auth.uid();
  if not found then
    raise exception 'auth user not found';
  end if;

  perform public.apply_auth_user_to_public_users(au);

  select * into row from public.users where id = auth.uid();
  return row;
end;
$$;

revoke all on function public.sync_my_user_from_auth() from public;
grant execute on function public.sync_my_user_from_auth() to authenticated;

revoke all on function public.apply_auth_user_to_public_users(auth.users) from public;

-- =============================================================================
-- Analytics views (aggregates respect RLS - admin sees global totals)
-- =============================================================================

drop view if exists public.subscription_stats;
drop view if exists public.vendor_stats;
drop view if exists public.revenue_stats;
drop view if exists public.booking_stats;
drop view if exists public.vendor_stats;
drop view if exists public.technician_stats;
drop view if exists public.ops_booking_exceptions;
drop view if exists public.subscription_stats;

create view public.booking_stats
with (security_invoker = true) as
select
  count(*)::bigint as total_bookings,
  count(*) filter (where status = 'completed'::public.booking_status)::bigint as completed_bookings,
  count(*) filter (where status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status))::bigint
    as pending_bookings
from public.bookings;

create view public.revenue_stats
with (security_invoker = true) as
select
  coalesce(
    (select sum(p.amount)::bigint from public.payments p where p.status = 'success'::public.payment_status),
    0::bigint
  ) as total_revenue_cents,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'revenue_cents', d.revenue_cents
        )
        order by d.day
      )
      from (
        select
          ((p.created_at at time zone 'Asia/Kolkata')::date) as day,
          sum(p.amount)::bigint as revenue_cents
        from public.payments p
        where p.status = 'success'::public.payment_status
        group by 1
      ) d
    ),
    '[]'::jsonb
  ) as revenue_per_day;

create view public.vendor_stats
with (security_invoker = true) as
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
  end as completion_rate,
  round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
  round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
  count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
left join public.job_reports jr on jr.booking_id = b.id
group by v.id;

create view public.technician_stats
with (security_invoker = true) as
select
  t.id as technician_id,
  count(b.id)::bigint as total_jobs,
  round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
  round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
  count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
from public.technicians t
left join public.bookings b on b.technician_id = t.id
left join public.job_reports jr on jr.booking_id = b.id
group by t.id;

create view public.ops_booking_exceptions
with (security_invoker = true) as
select
  b.id as booking_id,
  b.reference_code,
  b.status,
  b.vendor_id,
  b.technician_id,
  b.scheduled_start,
  b.scheduled_end,
  b.created_at,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'default_vendor_unclaimed'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
      then 'vendor_slow_confirmation'
    when b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
      then 'visit_not_started'
    when b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
      then 'visit_not_closed'
    when b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
      then 'schedule_missed'
    else null
  end as issue_type,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
      then 'medium'
    when b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
      then 'high'
    when b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
      then 'medium'
    when b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
      then 'high'
    else null
  end as issue_level,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'Default-vendor window expired without claim'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
      then 'Vendor has not progressed booking after confirmation'
    when b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
      then 'Visit not started 2h after scheduled start'
    when b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
      then 'Visit not closed 2h after scheduled end'
    when b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
      then 'Scheduled window started without movement'
    else null
  end as issue_label
from public.bookings b
where b.status in (
  'confirmed'::public.booking_status,
  'accepted'::public.booking_status,
  'in_progress'::public.booking_status
)
  and (
    (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and now() > (b.created_at + interval '90 minutes')
    )
    or (
      b.status in ('accepted'::public.booking_status, 'in_progress'::public.booking_status)
      and b.actual_start is null
      and now() > (b.scheduled_start + interval '2 hours')
    )
    or (
      b.status = 'in_progress'::public.booking_status
      and b.actual_end is null
      and now() > (b.scheduled_end + interval '2 hours')
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and now() > (b.scheduled_start + interval '1 hour')
    )
  );

create view public.subscription_stats
with (security_invoker = true) as
select
  (
    select count(*)::bigint
    from public.subscriptions s
    where s.status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
      and s.ends_at > now()
  ) as active_subscriptions,
  (
    select count(*)::bigint
    from public.bookings bk
    where bk.subscription_id is not null
      and (bk.scheduled_start at time zone 'Asia/Kolkata')::date
        >= (now() at time zone 'Asia/Kolkata')::date
      and bk.status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status)
  ) as upcoming_services;

comment on view public.booking_stats is
  'Counts bookings by lifecycle; non-admin roles see counts only for rows visible via bookings RLS.';
comment on view public.revenue_stats is
  'total_revenue_cents and revenue_per_day JSON array; payment visibility follows payments RLS.';
comment on view public.vendor_stats is
  'Per-vendor job counts, rates, and customer rating aggregates; booking visibility follows bookings RLS.';
comment on view public.technician_stats is
  'Per-technician job volume and customer rating aggregates; visibility follows bookings/job_reports RLS.';
comment on view public.ops_booking_exceptions is
  'Operational exception queue for bookings requiring admin intervention.';
comment on view public.subscription_stats is
  'Active AMC rows and upcoming subscription-linked bookings; respects RLS.';

grant select on public.booking_stats to authenticated;
grant select on public.revenue_stats to authenticated;
grant select on public.vendor_stats to authenticated;
grant select on public.technician_stats to authenticated;
grant select on public.ops_booking_exceptions to authenticated;
grant select on public.subscription_stats to authenticated;

drop view if exists public.bookings_created_daily;

create view public.bookings_created_daily
with (security_invoker = true) as
select
  (b.created_at at time zone 'Asia/Kolkata')::date as day,
  count(*)::bigint as booking_count
from public.bookings b
group by 1;

comment on view public.bookings_created_daily is
  'Bookings created per calendar day (Asia/Kolkata); respects bookings RLS.';

grant select on public.bookings_created_daily to authenticated;

create or replace function public.get_vendor_public_stats(p_vendor_ids uuid[] default null)
returns table (
  vendor_id uuid,
  total_jobs bigint,
  acceptance_rate numeric,
  completion_rate numeric,
  avg_rating numeric,
  rating_count bigint,
  avg_rating_30d numeric,
  rating_count_30d bigint
)
language sql
stable
security definer
set search_path = public
as $$
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
    end as completion_rate,
    round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
    count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count,
    round(avg(jr.customer_rating) filter (where jr.completed_at >= (now() - interval '30 days'))::numeric, 2) as avg_rating_30d,
    count(jr.id) filter (where jr.customer_rating is not null and jr.completed_at >= (now() - interval '30 days'))::bigint as rating_count_30d
  from public.vendors v
  left join public.bookings b on b.vendor_id = v.id
  left join public.job_reports jr on jr.booking_id = b.id
  where (
    public.is_admin()
    or v.approval_status = 'approved'::public.vendor_approval_status
  )
    and (p_vendor_ids is null or cardinality(p_vendor_ids) = 0 or v.id = any(p_vendor_ids))
  group by v.id;
$$;

grant execute on function public.get_vendor_public_stats(uuid[]) to authenticated;

-- Partner registration intake (`vendor_registration_intake`, RPCs, `vendor-intake` storage): apply migration
-- `20260610120000_vendor_registration_intake.sql` after this file.

-- =============================================================================
-- End of schema
-- =============================================================================
