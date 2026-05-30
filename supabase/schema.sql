-- =============================================================================
-- OorjaManDB - full public schema (Supabase / PostgreSQL)
-- AUTO-GENERATED from supabase/migrations/ via: node scripts/build-supabase-reference.mjs
-- Do not edit by hand for structural changes - add a migration, then re-run this script.
--
-- Deploy: use supabase db push (migrations are source of truth for UAT/Prod).
-- Manual bootstrap: apply this file, then policies.sql, then storage.sql if needed.
-- Requires: Supabase Auth (auth.users)
-- =============================================================================

create extension if not exists "pgcrypto";

-- ----- 20260501120000_booking_status_awaiting_confirmation.sql -----
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'awaiting_confirmation'
  ) then
    alter type public.booking_status add value 'awaiting_confirmation';

end if;

end $$;

-- ----- 20260501120001_vendor_registration.sql -----
alter table public.vendors add column if not exists company_type text;

alter table public.vendors add column if not exists company_registration_number text;

alter table public.vendors add column if not exists website_url text;

alter table public.vendors add column if not exists contact_person_name text;

alter table public.vendors add column if not exists contact_person_role text;

alter table public.vendors add column if not exists contact_person_phone text;

alter table public.vendors add column if not exists contact_person_email text;

alter table public.vendors add column if not exists service_areas text[];

alter table public.vendors add column if not exists experience_summary text;

alter table public.vendors add column if not exists years_in_business numeric(6, 1);

alter table public.vendors add column if not exists equipment_available text[];

alter table public.vendors add column if not exists flag_safety_training boolean not null default false;

alter table public.vendors add column if not exists flag_ppe_available boolean not null default false;

alter table public.vendors add column if not exists flag_insurance_coverage boolean not null default false;

alter table public.vendors add column if not exists doc_pan_url text;

alter table public.vendors add column if not exists doc_aadhaar_url text;

alter table public.vendors add column if not exists doc_gst_url text;

alter table public.vendors add column if not exists doc_bank_proof_url text;

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

-- ----- 20260502120000_technician_onboarding.sql -----
do $$ begin
  create type public.technician_verification_status as enum (
    'pending_review',
    'verified',
    'rejected'
  );

exception
  when duplicate_object then null;

end $$;

alter table public.technicians add column if not exists verification_status public.technician_verification_status;

alter table public.technicians add column if not exists verification_submitted_at timestamptz;

alter table public.technicians add column if not exists verification_reviewed_at timestamptz;

alter table public.technicians add column if not exists verification_rejection_reason text;

alter table public.technicians add column if not exists date_of_birth date;

alter table public.technicians add column if not exists personal_phone text;

alter table public.technicians add column if not exists emergency_contact_name text;

alter table public.technicians add column if not exists emergency_contact_phone text;

alter table public.technicians add column if not exists aadhaar_last4 text;

alter table public.technicians add column if not exists pan_number text;

alter table public.technicians add column if not exists doc_aadhaar_url text;

alter table public.technicians add column if not exists doc_pan_url text;

alter table public.technicians add column if not exists experience_summary text;

alter table public.technicians add column if not exists years_experience numeric(6, 1);

alter table public.technicians add column if not exists flag_safety_training boolean not null default false;

alter table public.technicians add column if not exists flag_height_work_cert boolean not null default false;

alter table public.technicians add column if not exists bank_account_holder_name text;

alter table public.technicians add column if not exists bank_account_last4 text;

alter table public.technicians add column if not exists bank_ifsc text;

alter table public.technicians add column if not exists doc_bank_proof_url text;

alter table public.technicians add column if not exists preferred_work_locations text[];

update public.technicians
set verification_status = 'verified'::public.technician_verification_status
where verification_status is null and coalesce(is_verified, false) = true;

update public.technicians
set verification_status = 'pending_review'::public.technician_verification_status
where verification_status is null;

update public.technicians
set verification_submitted_at = created_at
where verification_submitted_at is null;

alter table public.technicians
  alter column verification_status set default 'pending_review'::public.technician_verification_status;

alter table public.technicians
  alter column verification_status set not null;

create index if not exists technicians_verification_status_idx on public.technicians (verification_status);

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

new.verification_status := 'pending_review'::public.technician_verification_status;

return new;

end;

$$;

drop trigger if exists technicians_normalize_insert on public.technicians;

create trigger technicians_normalize_insert
before insert on public.technicians
for each row execute function public.technicians_normalize_insert();

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

if new.verification_status is distinct from old.verification_status
     or new.is_verified is distinct from old.is_verified
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Not allowed to change verification fields';

end if;

return new;

end;

$$;

drop trigger if exists technicians_guard_verification_writes on public.technicians;

create trigger technicians_guard_verification_writes
before update on public.technicians
for each row execute function public.technicians_guard_verification_writes();

-- ----- 20260503120000_customer_onboarding.sql -----
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

update public.customers
set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;

-- ----- 20260504120000_booking_vendor_code.sql -----
alter table public.bookings add column if not exists booking_code text;

create unique index if not exists bookings_booking_code_key on public.bookings (booking_code)
  where booking_code is not null;

comment on column public.bookings.booking_code is 'Vendor acceptance code (VIS-…). Set when the vendor accepts the request.';

-- ----- 20260505120000_platform_settings_vendor_fallback.sql -----
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  default_vendor_id uuid references public.vendors (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

comment on table public.platform_settings is 'Singleton (id=1). default_vendor_id used when customer preferred vendor cannot serve the site.';

-- ----- 20260515120000_technician_name_as_per_aadhaar.sql -----
alter table public.technicians
  add column if not exists name_as_per_aadhaar text;

comment on column public.technicians.name_as_per_aadhaar is
  'Full name as on Aadhaar / identity - required at technician onboarding step 1.';

-- ----- 20260515194200_pricing_tier_geo_capacity_addons.sql -----
alter table public.pricing_tiers
  add column if not exists visit_addon_cents integer not null default 0
    check (visit_addon_cents >= 0 and visit_addon_cents <= 1000000000),
  add column if not exists amc_addon_cents integer not null default 0
    check (amc_addon_cents >= 0 and amc_addon_cents <= 1000000000);

comment on column public.pricing_tiers.visit_addon_cents is
  'Flat INR add-on (same unit as amount_cents) added to one-time visit catalogue price when city maps to this tier.';

comment on column public.pricing_tiers.amc_addon_cents is
  'Flat INR add-on added to AMC catalogue plan price when subscription service address city maps to this tier.';

-- ----- 20260516120000_auth_user_phone_sync.sql -----
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone, role)
  values (
    new.id,
    nullif(lower(trim(coalesce(new.email, ''))), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', '')), ''),
    public.coerce_user_role(new.raw_user_meta_data->>'role')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    phone = coalesce(excluded.phone, public.users.phone),
    updated_at = now();

return new;

end;

$$;

-- ----- 20260517120000_assert_user_role_extension_security_definer.sql -----
create or replace function public.assert_user_role_extension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;

begin
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

-- ----- 20260526120000_pricing_rules.sql -----
create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  city text,
  base_price bigint not null default 0 check (base_price >= 0),
  per_panel_rate bigint not null default 0 check (per_panel_rate >= 0),
  per_kw_rate bigint not null default 0 check (per_kw_rate >= 0),
  multiplier numeric(10, 4) not null default 1.0 check (multiplier > 0),
  created_at timestamptz not null default now(),
  constraint pricing_rules_city_nonempty check (city is null or length(trim(city)) > 0)
);

comment on table public.pricing_rules is 'Estimate: subtotal_paise = base + panels*per_panel + kw*per_kw; final = round(subtotal * multiplier). City-specific rule overrides matching location; else default (city null).';

create unique index if not exists pricing_rules_single_default_idx on public.pricing_rules ((1))
where city is null;

create unique index if not exists pricing_rules_city_lower_unique on public.pricing_rules (lower(trim(city)))
where city is not null;

insert into public.pricing_rules (city, base_price, per_panel_rate, per_kw_rate, multiplier)
select null::text, 0, 0, 0, 1.0
where not exists (select 1 from public.pricing_rules pr where pr.city is null);

-- ----- 20260527120000_payments.sql -----
do $enum$
begin
  create type public.payment_status as enum ('pending', 'success', 'failed');

exception
  when duplicate_object then null;

end $enum$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists payments_customer_id_idx on public.payments (customer_id);

create index if not exists payments_booking_id_idx on public.payments (booking_id)
  where booking_id is not null;

-- ----- 20260528120000_booking_status_payment_gate.sql -----
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'booking_status'
      and e.enumlabel = 'pending_payment'
  ) then
    raise notice 'booking_status already migrated; skipping 20260528120000.';

return;

end if;

execute 'alter table public.bookings alter column status drop default';

if not exists (
    select 1
    from pg_type t
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'booking_status_new'
  ) then
    execute $sql$
      create type public.booking_status_new as enum (
        'pending_payment',
        'confirmed',
        'accepted',
        'in_progress',
        'completed',
        'cancelled'
      )
    $sql$;

end if;

execute 'alter table public.bookings alter column status type text using (status::text)';

execute $sql$
    update public.bookings
    set status = case status
      when 'draft' then 'pending_payment'
      when 'requested' then 'confirmed'
      when 'awaiting_confirmation' then 'confirmed'
      when 'confirmed' then 'confirmed'
      when 'assigned' then 'accepted'
      when 'in_progress' then 'in_progress'
      when 'completed' then 'completed'
      when 'cancelled' then 'cancelled'
      when 'no_show' then 'cancelled'
      else 'confirmed'
    end
  $sql$;

execute 'alter table public.bookings alter column status type public.booking_status_new using (status::public.booking_status_new)';

execute 'alter table public.bookings alter column status set default ''pending_payment''::public.booking_status_new';

execute 'drop type public.booking_status';

execute 'alter type public.booking_status_new rename to booking_status';

end $$;

-- ----- 20260529120000_technician_locations.sql -----
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

-- ----- 20260531120000_analytics_views.sql -----
drop view if exists public.subscription_stats;

drop view if exists public.vendor_stats;

drop view if exists public.revenue_stats;

drop view if exists public.booking_stats;

create view public.booking_stats as
select
  count(*)::bigint as total_bookings,
  count(*) filter (where status = 'completed'::public.booking_status)::bigint as completed_bookings,
  count(*) filter (where status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status))::bigint
    as pending_bookings
from public.bookings;

comment on view public.booking_stats is
  'Counts bookings by lifecycle; non-admin roles see counts only for rows visible via bookings RLS.';

create view public.revenue_stats as
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

comment on view public.revenue_stats is
  'total_revenue_cents and revenue_per_day JSON array; payment visibility follows payments RLS.';

create view public.vendor_stats as
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
  end as completion_rate
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
group by v.id;

comment on view public.vendor_stats is
  'Per-vendor job counts and rates; booking visibility follows bookings RLS (vendors see own stats).';

create view public.subscription_stats as
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

comment on view public.subscription_stats is
  'Active AMC rows and count of upcoming subscription-linked bookings; respects RLS on underlying tables.';

grant select on public.booking_stats to authenticated;

grant select on public.revenue_stats to authenticated;

grant select on public.vendor_stats to authenticated;

grant select on public.subscription_stats to authenticated;

-- ----- 20260601120000_bookings_created_daily_view.sql -----
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

-- ----- 20260602120000_bookings_realtime_publication.sql -----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

END IF;

END $$;

$$;

-- ----- 20260606120000_customer_registration_extensions.sql -----
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

-- ----- 20260606193000_vendor_technician_invites_and_vendor_review.sql -----
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

-- ----- 20260607120000_technician_verification_draft.sql -----
alter type public.technician_verification_status add value if not exists 'draft';

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

if new.verification_status is distinct from old.verification_status
     or new.is_verified is distinct from old.is_verified
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Not allowed to change verification fields';

end if;

return new;

end;

$$;

-- ----- 20260609120000_technician_oorja_form_extensions.sql -----
alter table public.technicians
  add column if not exists father_guardian_name text,
  add column if not exists gender text,
  add column if not exists contact_email text,
  add column if not exists employer_registration_ref text,
  add column if not exists safety_training_org text,
  add column if not exists doc_passport_url text,
  add column if not exists doc_safety_certificate_url text,
  add column if not exists flag_solar_cleaning_experience boolean not null default false,
  add column if not exists other_skills text;

alter table public.technicians
  drop constraint if exists technicians_gender_chk;

alter table public.technicians
  add constraint technicians_gender_chk
  check (
    gender is null
    or gender in ('female', 'male', 'other', 'prefer_not_to_say')
  );

-- ----- 20260610120000_vendor_registration_intake.sql -----
do $enum$
begin
  create type public.vendor_registration_intake_status as enum (
    'draft',
    'submitted',
    'approved',
    'rejected'
  );

exception
  when duplicate_object then null;

end $enum$;

create table if not exists public.vendor_registration_intake (
  id uuid primary key default gen_random_uuid (),
  status public.vendor_registration_intake_status not null default 'draft',
  draft_access_token uuid not null default gen_random_uuid (),
  form_data jsonb not null default '{}'::jsonb,
  step_index integer not null default 0,
  business_name text,
  contact_email text,
  contact_phone text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  rejection_reason text,
  created_user_id uuid references public.users (id) on delete set null,
  created_vendor_id uuid references public.vendors (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint vendor_registration_intake_rejection_when_rejected check (
    status <> 'rejected'
    or (
      rejection_reason is not null
      and btrim (rejection_reason) <> ''
    )
  ),
  constraint vendor_registration_intake_approved_links check (
    status <> 'approved'
    or (
      created_user_id is not null
      and created_vendor_id is not null
      and reviewed_at is not null
      and approved_at is not null
    )
  )
);

create unique index if not exists vendor_registration_intake_draft_token_idx
  on public.vendor_registration_intake (draft_access_token);

create index if not exists vendor_registration_intake_status_idx
  on public.vendor_registration_intake (status);

create index if not exists vendor_registration_intake_submitted_at_idx
  on public.vendor_registration_intake (submitted_at desc);

drop trigger if exists vendor_registration_intake_set_updated_at on public.vendor_registration_intake;

create trigger vendor_registration_intake_set_updated_at
before update on public.vendor_registration_intake
for each row execute function public.set_updated_at ();

create or replace function public.create_vendor_registration_intake (p_initial_form jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid ();

v_token uuid := gen_random_uuid ();

v_business text;

v_email text;

v_phone text;

begin
  v_business := left(
    trim(
      coalesce(
        p_initial_form ->> 'business_name',
        p_initial_form ->> 'partner_login_email',
        'Draft partner application'
      )
    ),
    200
  );

v_email := nullif(
    trim(
      coalesce(
        p_initial_form ->> 'partner_login_email',
        p_initial_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );

v_phone := nullif(
    trim(coalesce(p_initial_form ->> 'partner_login_phone_e164', p_initial_form ->> 'partner_login_phone', '')),
    ''
  );

insert into public.vendor_registration_intake (
    id,
    status,
    form_data,
    draft_access_token,
    business_name,
    contact_email,
    contact_phone,
    step_index
  )
  values (
    v_id,
    'draft',
    coalesce(p_initial_form, '{}'::jsonb),
    v_token,
    v_business,
    v_email,
    v_phone,
    0
  );

return jsonb_build_object('id', v_id, 'draft_token', v_token);

end;

$$;

create or replace function public.get_vendor_registration_intake (p_id uuid, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;

begin
  select form_data, step_index, status
    into r
  from public.vendor_registration_intake
  where
    id = p_id
    and draft_access_token = p_token;

if not found then
    return null;

end if;

return jsonb_build_object(
    'form_data',
    r.form_data,
    'step_index',
    r.step_index,
    'status',
    r.status
  );

end;

$$;

create or replace function public.update_vendor_registration_intake (
  p_id uuid,
  p_token uuid,
  p_form jsonb,
  p_step_index integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business text;

v_email text;

v_phone text;

begin
  v_business := left(
    trim(
      coalesce(
        p_form ->> 'business_name',
        p_form ->> 'partner_login_email',
        'Draft partner application'
      )
    ),
    200
  );

v_email := nullif(
    trim(
      coalesce(
        p_form ->> 'partner_login_email',
        p_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );

v_phone := nullif(
    trim(coalesce(p_form ->> 'partner_login_phone_e164', p_form ->> 'partner_login_phone', '')),
    ''
  );

update public.vendor_registration_intake
  set
    form_data = coalesce(p_form, '{}'::jsonb),
    step_index = greatest (0, coalesce(p_step_index, 0)),
    business_name = v_business,
    contact_email = v_email,
    contact_phone = v_phone
  where
    id = p_id
    and draft_access_token = p_token
    and status = 'draft';

if not found then
    raise exception 'Invalid intake, wrong token, or intake is not editable';

end if;

end;

$$;

create or replace function public.submit_vendor_registration_intake (p_id uuid, p_token uuid, p_form jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;

v_phone text;

v_business text;

begin
  v_email := nullif(
    trim(
      coalesce(
        p_form ->> 'partner_login_email',
        p_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );

v_phone := nullif(
    trim(coalesce(p_form ->> 'partner_login_phone_e164', p_form ->> 'partner_login_phone', '')),
    ''
  );

v_business := left(trim(coalesce(p_form ->> 'business_name', '')), 200);

if v_business is null or v_business = '' then
    raise exception 'business_name is required';

end if;

if v_email is null or v_email = '' then
    raise exception 'partner_login_email is required';

end if;

if v_phone is null or v_phone = '' then
    raise exception 'partner_login_phone is required';

end if;

update public.vendor_registration_intake
  set
    form_data = coalesce(p_form, '{}'::jsonb),
    step_index = greatest (0, step_index),
    business_name = v_business,
    contact_email = v_email,
    contact_phone = v_phone,
    status = 'submitted',
    submitted_at = now ()
  where
    id = p_id
    and draft_access_token = p_token
    and status = 'draft';

if not found then
    raise exception 'Invalid intake, wrong token, or already submitted';

end if;

end;

$$;

grant execute on function public.create_vendor_registration_intake (jsonb) to anon,
authenticated;

grant execute on function public.get_vendor_registration_intake (uuid, uuid) to anon,
authenticated;

grant execute on function public.update_vendor_registration_intake (uuid, uuid, jsonb, integer) to anon,
authenticated;

grant execute on function public.submit_vendor_registration_intake (uuid, uuid, jsonb) to anon,
authenticated;

create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text;

iid uuid;

begin
  seg := split_part(trim(both '/' from coalesce(object_path, '')), '/', 1);

if seg = '' then
    return false;

end if;

begin
    iid := seg::uuid;

exception
    when invalid_text_representation then
      return false;

end;

return exists (
    select
      1
    from
      public.vendor_registration_intake v
    where
      v.id = iid
      and v.status = 'draft'::public.vendor_registration_intake_status
  );

end;

$$;

do $owner$
declare
  tbl_owner name;

begin
  select pg_catalog.pg_get_userbyid (c.relowner)::name
    into tbl_owner
  from
    pg_class c
    join pg_namespace n on n.oid = c.relnamespace
  where
    n.nspname = 'public'
    and c.relname = 'vendor_registration_intake'
    and c.relkind = 'r';

if tbl_owner is not null then
    execute format(
      'alter function public.vendor_intake_allows_storage_upload(text) owner to %I',
      tbl_owner
    );

end if;

end
$owner$;

grant execute on function public.vendor_intake_allows_storage_upload (text) to anon,
authenticated;

-- ----- 20260611120000_fix_vendor_intake_storage_helper.sql -----
create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text;

iid uuid;

begin
  seg := split_part(trim(both '/' from coalesce(object_path, '')), '/', 1);

if seg = '' then
    return false;

end if;

begin
    iid := seg::uuid;

exception
    when invalid_text_representation then
      return false;

end;

return exists (
    select
      1
    from
      public.vendor_registration_intake v
    where
      v.id = iid
      and v.status = 'draft'::public.vendor_registration_intake_status
  );

end;

$$;

do $owner$
declare
  tbl_owner name;

begin
  select pg_catalog.pg_get_userbyid (c.relowner)::name
    into tbl_owner
  from
    pg_class c
    join pg_namespace n on n.oid = c.relnamespace
  where
    n.nspname = 'public'
    and c.relname = 'vendor_registration_intake'
    and c.relkind = 'r';

if tbl_owner is not null then
    execute format(
      'alter function public.vendor_intake_allows_storage_upload(text) owner to %I',
      tbl_owner
    );

end if;

end
$owner$;

-- ----- 20260612120000_vendor_intake_storage_no_set_local.sql -----
create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text;

iid uuid;

begin
  seg := split_part(trim(both '/' from coalesce(object_path, '')), '/', 1);

if seg = '' then
    return false;

end if;

begin
    iid := seg::uuid;

exception
    when invalid_text_representation then
      return false;

end;

return exists (
    select
      1
    from
      public.vendor_registration_intake v
    where
      v.id = iid
      and v.status = 'draft'::public.vendor_registration_intake_status
  );

end;

$$;

do $owner$
declare
  tbl_owner name;

begin
  select pg_catalog.pg_get_userbyid (c.relowner)::name
    into tbl_owner
  from
    pg_class c
    join pg_namespace n on n.oid = c.relnamespace
  where
    n.nspname = 'public'
    and c.relname = 'vendor_registration_intake'
    and c.relkind = 'r';

if tbl_owner is not null then
    execute format(
      'alter function public.vendor_intake_allows_storage_upload(text) owner to %I',
      tbl_owner
    );

end if;

end
$owner$;

-- ----- 20260613120000_vendor_intake_storage_token_path.sql -----
create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p text;

seg1 text;

seg2 text;

iid uuid;

tok uuid;

begin
  p := trim(both '/' from coalesce(object_path, ''));

seg1 := split_part(p, '/', 1);

seg2 := split_part(p, '/', 2);

if seg1 = '' or seg2 = '' then
    return false;

end if;

begin
    iid := seg1::uuid;

tok := seg2::uuid;

exception
    when invalid_text_representation then
      return false;

end;

return exists (
    select
      1
    from
      public.vendor_registration_intake v
    where
      v.id = iid
      and v.draft_access_token = tok
      and v.status = 'draft'::public.vendor_registration_intake_status
  );

end;

$$;

alter table public.vendor_registration_intake no force row level security;

alter function public.vendor_intake_allows_storage_upload (text) owner to postgres;

revoke all on public.vendor_registration_intake from public;

revoke all on public.vendor_registration_intake from anon;

grant select on public.vendor_registration_intake to authenticated;

grant all on public.vendor_registration_intake to service_role;

-- ----- 20260614120000_booking_status_vendor_acknowledged.sql -----
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'vendor_acknowledged'
  ) then
    alter type public.booking_status add value 'vendor_acknowledged';

end if;

end $$;

-- ----- 20260614120001_vendor_stats_vendor_acknowledged.sql -----
drop view if exists public.vendor_stats;

create view public.vendor_stats as
select
  v.id as vendor_id,
  count(b.id)::bigint as total_jobs,
  case
    when count(b.id) filter (
      where b.status in (
        'confirmed'::public.booking_status,
        'vendor_acknowledged'::public.booking_status,
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
              'vendor_acknowledged'::public.booking_status,
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
  end as completion_rate
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
group by v.id;

comment on view public.vendor_stats is
  'Per-vendor job counts and rates; booking visibility follows bookings RLS (vendors see own stats).';

grant select on public.vendor_stats to authenticated;

-- ----- 20260614130000_cleanup_vendor_acknowledged_flow.sql -----
update public.bookings
set
  status = case
    when technician_id is not null then 'accepted'::public.booking_status
    else 'confirmed'::public.booking_status
  end,
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{vendor_acceptance,migrated_from_vendor_acknowledged}',
    'true'::jsonb,
    true
  ),
  updated_at = now()
where status = 'vendor_acknowledged'::public.booking_status;

drop view if exists public.vendor_stats;

create view public.vendor_stats as
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
  end as completion_rate
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
group by v.id;

comment on view public.vendor_stats is
  'Per-vendor job counts and rates; booking visibility follows bookings RLS (vendors see own stats).';

grant select on public.vendor_stats to authenticated;

-- ----- 20260614133000_ops_booking_exceptions_view.sql -----
drop view if exists public.ops_booking_exceptions;

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

comment on view public.ops_booking_exceptions is
  'Operational exception queue for bookings requiring admin intervention.';

grant select on public.ops_booking_exceptions to authenticated;

-- ----- 20260614143000_vendor_slot_availability.sql -----
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

-- ----- 20260614150000_notification_events.sql -----
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  recipient_vendor_id uuid references public.vendors (id) on delete cascade,
  event_type text not null,
  channels jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_booking_idx on public.notification_events (booking_id, created_at desc);

create index if not exists notification_events_vendor_idx on public.notification_events (recipient_vendor_id, created_at desc);

create index if not exists notification_events_status_idx on public.notification_events (status, created_at desc);

-- ----- 20260614153000_notification_events_delivery_state.sql -----
alter table public.notification_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists demo_mode boolean not null default true;

create index if not exists notification_events_retry_idx
  on public.notification_events (status, next_attempt_at, created_at);

-- ----- 20260614160000_notification_templates.sql -----
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

insert into public.notification_templates (event_type, channel, template_key, subject, body)
values
  ('marketplace_broadcast', 'in_app', 'default', 'New marketplace request', 'A new booking request is available to claim.'),
  ('marketplace_broadcast', 'email', 'default', 'New marketplace request', 'You have a new marketplace request. Please claim quickly.'),
  ('marketplace_broadcast', 'sms', 'default', null, 'New Oorjaman marketplace request available. Open vendor dashboard to claim.'),
  ('marketplace_broadcast', 'whatsapp', 'default', null, 'New marketplace request available on Oorjaman. Open dashboard to claim.'),
  ('marketplace_claim_won', 'in_app', 'default', 'Booking claim confirmed', 'You claimed this marketplace booking successfully.'),
  ('marketplace_claim_won', 'email', 'default', 'Booking claim confirmed', 'Your team has successfully claimed the marketplace booking.'),
  ('marketplace_claim_won', 'sms', 'default', null, 'Booking claim confirmed on Oorjaman.'),
  ('marketplace_claim_won', 'whatsapp', 'default', null, 'Booking claim confirmed on Oorjaman.')
on conflict (event_type, channel, template_key) do nothing;

-- ----- 20260614164000_notification_channel_settings.sql -----
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

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('marketplace_broadcast', 'in_app', true, false),
  ('marketplace_broadcast', 'email', true, false),
  ('marketplace_broadcast', 'sms', true, false),
  ('marketplace_broadcast', 'whatsapp', true, false),
  ('marketplace_claim_won', 'in_app', true, false),
  ('marketplace_claim_won', 'email', true, false),
  ('marketplace_claim_won', 'sms', true, false),
  ('marketplace_claim_won', 'whatsapp', true, false)
on conflict (event_type, channel) do nothing;

-- ----- 20260616120000_vendor_technician_rating_stats.sql -----
drop view if exists public.technician_stats;

drop view if exists public.vendor_stats;

create view public.vendor_stats as
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
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count
from public.vendors v
left join public.bookings b on b.vendor_id = v.id
left join public.job_reports jr on jr.booking_id = b.id
group by v.id;

create view public.technician_stats as
select
  t.id as technician_id,
  count(b.id)::bigint as total_jobs,
  round(avg(jr.customer_rating)::numeric, 2) as avg_rating,
  count(jr.id) filter (where jr.customer_rating is not null)::bigint as rating_count
from public.technicians t
left join public.bookings b on b.technician_id = t.id
left join public.job_reports jr on jr.booking_id = b.id
group by t.id;

grant select on public.vendor_stats to authenticated;

grant select on public.technician_stats to authenticated;

comment on view public.vendor_stats is
  'Per-vendor job counts, acceptance/completion, and customer rating aggregates; booking visibility follows bookings RLS.';

comment on view public.technician_stats is
  'Per-technician completed job and customer rating aggregates derived from bookings/job_reports; RLS applies through base tables.';

-- ----- 20260616123000_rating_trend_30d_stats.sql -----
drop view if exists public.technician_stats;

drop view if exists public.vendor_stats;

create view public.vendor_stats as
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

create view public.technician_stats as
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

grant select on public.vendor_stats to authenticated;

grant select on public.technician_stats to authenticated;

-- ----- 20260616124500_job_report_feedback_moderation.sql -----
alter table public.job_reports
  add column if not exists feedback_hidden boolean not null default false;

alter table public.job_reports
  add column if not exists feedback_hidden_reason text;

alter table public.job_reports
  add column if not exists feedback_hidden_at timestamptz;

alter table public.job_reports
  add column if not exists feedback_hidden_by uuid references public.users (id) on delete set null;

create index if not exists job_reports_feedback_hidden_idx
  on public.job_reports (feedback_hidden, completed_at desc);

-- ----- 20260616130000_subscription_renewal_nudge_templates.sql -----
insert into public.notification_templates (event_type, channel, template_key, subject, body, is_active)
values
  (
    'subscription_renewal_nudge',
    'email',
    'sub_renewal_email_v1',
    'Your Oorjaman AMC is due for renewal',
    'Hi {{customer_name}}, your {{plan_name}} plan expires on {{ends_at}}. Renew now to keep uninterrupted service.',
    true
  ),
  (
    'subscription_renewal_nudge',
    'sms',
    'sub_renewal_sms_v1',
    null,
    'Oorjaman: Your {{plan_name}} plan expires on {{ends_at}}. Renew now to avoid service gap.',
    true
  ),
  (
    'subscription_renewal_nudge',
    'whatsapp',
    'sub_renewal_whatsapp_v1',
    null,
    'Hi {{customer_name}}, reminder from Oorjaman: {{plan_name}} expires on {{ends_at}}. Renew now.',
    true
  )
on conflict (event_type, channel, template_key) do update
set
  subject = excluded.subject,
  body = excluded.body,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('subscription_renewal_nudge', 'email', true, false),
  ('subscription_renewal_nudge', 'sms', true, false),
  ('subscription_renewal_nudge', 'whatsapp', true, false)
on conflict (event_type, channel) do update
set
  enabled_demo = excluded.enabled_demo,
  enabled_live = excluded.enabled_live,
  updated_at = now();

-- ----- 20260616132000_low_rating_followup_templates.sql -----
insert into public.notification_templates (event_type, channel, template_key, subject, body, is_active)
values
  (
    'low_rating_followup',
    'email',
    'default',
    'Action needed: low-rated service {{reference_code}}',
    'A customer rated {{rating}}/5 for booking {{reference_code}}. Review feedback: {{feedback}}',
    true
  ),
  (
    'low_rating_followup',
    'sms',
    'default',
    null,
    'Low rating alert: {{reference_code}} got {{rating}}/5. Check feedback in admin.',
    true
  ),
  (
    'low_rating_followup',
    'whatsapp',
    'default',
    null,
    'Low rating alert for {{reference_code}}: {{rating}}/5. Please follow up with customer.',
    true
  ),
  (
    'low_rating_followup',
    'in_app',
    'default',
    'Low rating requires follow-up',
    'Booking {{reference_code}} has a low customer rating ({{rating}}/5).',
    true
  )
on conflict (event_type, channel, template_key) do update
set
  subject = excluded.subject,
  body = excluded.body,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('low_rating_followup', 'email', true, false),
  ('low_rating_followup', 'sms', true, false),
  ('low_rating_followup', 'whatsapp', true, false),
  ('low_rating_followup', 'in_app', true, false)
on conflict (event_type, channel) do update
set
  enabled_demo = excluded.enabled_demo,
  enabled_live = excluded.enabled_live,
  updated_at = now();

-- ----- 20260617120000_pricing_tiers_city_maps.sql -----
create table if not exists public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'IN'
    check (length(trim(country_code)) >= 2 and length(trim(country_code)) <= 3),
  code text not null
    check (length(trim(code)) > 0),
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (country_code, code)
);

comment on table public.pricing_tiers is 'Named pricing tiers per country (e.g. metro bands). Rates live in pricing_rules rows with matching tier_code.';

create table if not exists public.pricing_city_tiers (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'IN'
    check (length(trim(country_code)) >= 2 and length(trim(country_code)) <= 3),
  city_key text not null
    check (length(trim(city_key)) > 0),
  state_key text,
  tier_code text not null,
  created_at timestamptz not null default now(),
  unique (country_code, city_key),
  constraint pricing_city_tiers_tier_fk
    foreign key (country_code, tier_code)
    references public.pricing_tiers (country_code, code)
    on delete restrict
);

comment on table public.pricing_city_tiers is 'Maps normalized customer city names to a pricing tier within a country.';

create index if not exists pricing_city_tiers_country_idx
  on public.pricing_city_tiers (country_code);

alter table public.pricing_rules
  add column if not exists country_code text not null default 'IN',
  add column if not exists tier_code text;

update public.pricing_rules set country_code = 'IN' where country_code is null;

alter table public.pricing_rules
  alter column country_code set default 'IN';

alter table public.pricing_rules drop constraint if exists pricing_rules_city_nonempty;

alter table public.pricing_rules
  add constraint pricing_rules_city_nonempty check (city is null or length(trim(city)) > 0),
  add constraint pricing_rules_tier_exclusive_city check (tier_code is null or city is null);

drop index if exists public.pricing_rules_single_default_idx;

drop index if exists public.pricing_rules_city_lower_unique;

create unique index if not exists pricing_rules_national_default_uq
  on public.pricing_rules (country_code)
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

alter table public.pricing_rules
  drop constraint if exists pricing_rules_tier_fk;

alter table public.pricing_rules
  add constraint pricing_rules_tier_fk
  foreign key (country_code, tier_code)
  references public.pricing_tiers (country_code, code)
  on delete restrict;

-- ----- 20260618120000_customer_metadata_partner_preferences.sql -----
comment on column public.customers.metadata is
'Extensible JSON. Partner prefs: metadata.fallback_vendor_id (uuid text), '
'metadata.service_addresses[] entries may include preferred_vendor_ids (uuid text array, app caps length), '
'and metadata.default_service_address_id selects the default saved site.';

-- ----- 20260618150000_vendor_slot_bookability_batch.sql -----
create or replace function public.vendor_slot_bookability_batch(
  p_vendor_id uuid,
  p_day_key text,
  p_slot_ids text[],
  p_exclude_booking_id uuid default null
)
returns table (slot_id text, bookable boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.slot_id,
    (
      coalesce(vsa.is_available, true)
      and coalesce(bcx.cnt, 0) < greatest(1, coalesce(vsa.capacity, 1)::int)
    ) as bookable
  from unnest(coalesce(p_slot_ids, array[]::text[])) as u(slot_id)
  left join public.vendor_slot_availability vsa
    on vsa.vendor_id = p_vendor_id
   and vsa.day_key = p_day_key::date
   and vsa.slot_id = u.slot_id
  left join lateral (
    select count(*)::int as cnt
    from public.bookings b
    where b.vendor_id = p_vendor_id
      and b.status in (
        'confirmed'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status
      )
      and b.metadata @> jsonb_build_object(
        'schedule_slot',
        jsonb_build_object('day_key', p_day_key, 'slot_id', u.slot_id)
      )
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  ) bcx on true;

$$;

revoke all on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) from public;

grant execute on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) to authenticated;

grant execute on function public.vendor_slot_bookability_batch(uuid, text, text[], uuid) to service_role;

-- ----- 20260618160000_pricing_national_default_audit.sql -----
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

comment on table public.pricing_national_default_audit is
'History of changes to national default rows in pricing_rules (both city and tier_code null).';

revoke all on public.pricing_national_default_audit from public;

grant select on public.pricing_national_default_audit to authenticated;

create or replace function public.pricing_rule_row_is_national(city text, tier_code text)
returns boolean
language sql
immutable
as $$
  select coalesce(btrim(city), '') = '' and coalesce(btrim(tier_code), '') = '';

$$;

create or replace function public.pricing_rules_log_national_default_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_nat boolean;

v_new_nat boolean;

begin
  if tg_op = 'INSERT' then
    v_new_nat := public.pricing_rule_row_is_national(new.city, new.tier_code);

if v_new_nat then
      insert into public.pricing_national_default_audit (
        pricing_rule_id, country_code, operation, old_snapshot, new_snapshot, changed_by
      ) values (
        new.id, new.country_code, 'insert', null, to_jsonb(new), auth.uid()
      );

end if;

return new;

elsif tg_op = 'DELETE' then
    v_old_nat := public.pricing_rule_row_is_national(old.city, old.tier_code);

if v_old_nat then
      insert into public.pricing_national_default_audit (
        pricing_rule_id, country_code, operation, old_snapshot, new_snapshot, changed_by
      ) values (
        old.id, old.country_code, 'delete', to_jsonb(old), null, auth.uid()
      );

end if;

return old;

elsif tg_op = 'UPDATE' then
    v_old_nat := public.pricing_rule_row_is_national(old.city, old.tier_code);

v_new_nat := public.pricing_rule_row_is_national(new.city, new.tier_code);

if v_old_nat or v_new_nat then
      insert into public.pricing_national_default_audit (
        pricing_rule_id, country_code, operation, old_snapshot, new_snapshot, changed_by
      ) values (
        new.id,
        new.country_code,
        'update',
        case when v_old_nat then to_jsonb(old) else null end,
        case when v_new_nat then to_jsonb(new) else null end,
        auth.uid()
      );

end if;

return new;

end if;

return null;

end;

$$;

drop trigger if exists pricing_rules_national_default_audit_trg on public.pricing_rules;

create trigger pricing_rules_national_default_audit_trg
after insert or update or delete on public.pricing_rules
for each row execute function public.pricing_rules_log_national_default_audit();

grant execute on function public.pricing_rule_row_is_national(text, text) to authenticated;

-- ----- 20260619100000_payments_paid_at_method.sql -----
alter table public.payments
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz;

comment on column public.payments.payment_method is 'Display label or short code for channel (e.g. UPI, Net banking).';

comment on column public.payments.paid_at is 'When the payment succeeded (IST-friendly display in apps).';

update public.payments
set paid_at = coalesce(paid_at, created_at)
where status = 'success'::public.payment_status
  and paid_at is null;

-- ----- 20260619120000_booking_reference_om_prefix.sql -----
alter table public.bookings
  alter column reference_code set default (
    'OM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

comment on column public.bookings.reference_code is 'Customer-facing booking id (OM-…). Unique. Vendor visit code remains booking_code (VIS-…).';

-- ----- 20260620120000_subscription_service_address_id.sql -----
alter table public.subscriptions
  add column if not exists service_address_id text;

comment on column public.subscriptions.service_address_id is
  'Id of customers.metadata.service_addresses[].id; at most one active/trialing AMC per customer per address.';

update public.subscriptions s
set service_address_id = coalesce(
  (
    select nullif(trim(c.metadata->>'default_service_address_id'), '')
    from public.customers c
    where c.id = s.customer_id
  ),
  'default'
)
where s.service_address_id is null;

update public.subscriptions s
set metadata = coalesce(s.metadata, '{}'::jsonb) || jsonb_build_object('service_address_id', s.service_address_id)
where s.service_address_id is not null
  and (s.metadata->>'service_address_id') is null;

create index if not exists subscriptions_service_address_id_idx
  on public.subscriptions (customer_id, service_address_id);

create unique index if not exists subscriptions_one_active_amc_per_address_idx
  on public.subscriptions (customer_id, service_address_id)
  where status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
    and service_address_id is not null
    and service_address_id <> '';

-- ----- 20260621120000_service_capacity_pricing.sql -----
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

drop trigger if exists service_capacity_tiers_set_updated_at on public.service_capacity_tiers;

create trigger service_capacity_tiers_set_updated_at
before update on public.service_capacity_tiers
for each row execute function public.set_updated_at();

drop trigger if exists pricing_one_time_rates_set_updated_at on public.pricing_one_time_rates;

create trigger pricing_one_time_rates_set_updated_at
before update on public.pricing_one_time_rates
for each row execute function public.set_updated_at();

drop trigger if exists pricing_amc_plans_set_updated_at on public.pricing_amc_plans;

create trigger pricing_amc_plans_set_updated_at
before update on public.pricing_amc_plans
for each row execute function public.set_updated_at();

create or replace function public.pricing_catalog_log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := tg_table_name;

v_country char(2);

v_id uuid;

begin
  if tg_op = 'INSERT' then
    v_country := new.country_code;

v_id := new.id;

insert into public.pricing_catalog_audit (table_name, record_id, country_code, operation, old_snapshot, new_snapshot, changed_by)
    values (v_table, v_id, v_country, 'insert', null, to_jsonb(new), auth.uid());

return new;

elsif tg_op = 'DELETE' then
    v_country := old.country_code;

v_id := old.id;

insert into public.pricing_catalog_audit (table_name, record_id, country_code, operation, old_snapshot, new_snapshot, changed_by)
    values (v_table, v_id, v_country, 'delete', to_jsonb(old), null, auth.uid());

return old;

elsif tg_op = 'UPDATE' then
    v_country := new.country_code;

v_id := new.id;

insert into public.pricing_catalog_audit (table_name, record_id, country_code, operation, old_snapshot, new_snapshot, changed_by)
    values (v_table, v_id, v_country, 'update', to_jsonb(old), to_jsonb(new), auth.uid());

return new;

end if;

return null;

end;

$$;

drop trigger if exists pricing_one_time_rates_audit_trg on public.pricing_one_time_rates;

create trigger pricing_one_time_rates_audit_trg
after insert or update or delete on public.pricing_one_time_rates
for each row execute function public.pricing_catalog_log_audit();

drop trigger if exists pricing_amc_plans_audit_trg on public.pricing_amc_plans;

create trigger pricing_amc_plans_audit_trg
after insert or update or delete on public.pricing_amc_plans
for each row execute function public.pricing_catalog_log_audit();

grant select on public.service_capacity_tiers to authenticated;

grant select on public.pricing_one_time_rates to authenticated;

grant select on public.pricing_amc_plans to authenticated;

grant select on public.pricing_catalog_audit to authenticated;

insert into public.service_capacity_tiers (country_code, code, capacity_kw, typical_panel_count, label, sort_order)
values
  ('IN', 'kw_3', 3, 6, '3 kW (5–6 panels)', 10),
  ('IN', 'kw_4', 4, 8, '4 kW (8 panels)', 20),
  ('IN', 'kw_5', 5, 10, '5 kW (10 panels)', 30),
  ('IN', 'kw_6', 6, 12, '6 kW (12 panels)', 40),
  ('IN', 'kw_8', 8, 15, '8 kW (15 panels)', 50),
  ('IN', 'kw_10', 10, 18, '10 kW (18 panels)', 60)
on conflict (country_code, code) do update set
  capacity_kw = excluded.capacity_kw,
  typical_panel_count = excluded.typical_panel_count,
  label = excluded.label,
  sort_order = excluded.sort_order;

insert into public.pricing_one_time_rates (country_code, capacity_tier_code, amount_cents, per_panel_rate_cents)
values
  ('IN', 'kw_3', 59900, 10000),
  ('IN', 'kw_4', 79900, 10000),
  ('IN', 'kw_5', 99900, 10000),
  ('IN', 'kw_6', 119900, 10000),
  ('IN', 'kw_8', 149900, 10000),
  ('IN', 'kw_10', 179900, 10000)
on conflict (country_code, capacity_tier_code) do update set
  amount_cents = excluded.amount_cents,
  per_panel_rate_cents = excluded.per_panel_rate_cents;

insert into public.pricing_amc_plans (
  country_code, capacity_tier_code, plan_code, plan_name, contract_months, visits_included, visits_per_year, amount_cents, billing_period, sort_order
) values
  ('IN', 'kw_3', 'amc_kw3_y1_3', '3 kW AMC · 1 yr · 3 visits/yr', 12, 3, 3, 159900, 'custom', 10),
  ('IN', 'kw_3', 'amc_kw3_y1_4', '3 kW AMC · 1 yr · 4 visits/yr', 12, 4, 4, 209900, 'custom', 20),
  ('IN', 'kw_3', 'amc_kw3_y2_6', '3 kW AMC · 2 yr · 6 visits', 24, 6, null, 319900, 'custom', 30),
  ('IN', 'kw_4', 'amc_kw4_y1_3', '4 kW AMC · 1 yr · 3 visits/yr', 12, 3, 3, 219900, 'custom', 10),
  ('IN', 'kw_4', 'amc_kw4_y1_4', '4 kW AMC · 1 yr · 4 visits/yr', 12, 4, 4, 299900, 'custom', 20),
  ('IN', 'kw_4', 'amc_kw4_y2_6', '4 kW AMC · 2 yr · 6 visits', 24, 6, null, 449900, 'custom', 30),
  ('IN', 'kw_5', 'amc_kw5_y1_3', '5 kW AMC · 1 yr · 3 visits/yr', 12, 3, 3, 279900, 'custom', 10),
  ('IN', 'kw_5', 'amc_kw5_y1_4', '5 kW AMC · 1 yr · 4 visits/yr', 12, 4, 4, 369900, 'custom', 20),
  ('IN', 'kw_5', 'amc_kw5_y2_6', '5 kW AMC · 2 yr · 6 visits', 24, 6, null, 549900, 'custom', 30),
  ('IN', 'kw_6', 'amc_kw6_y1_3', '6 kW AMC · 1 yr · 3 visits/yr', 12, 3, 3, 339900, 'custom', 10),
  ('IN', 'kw_6', 'amc_kw6_y1_4', '6 kW AMC · 1 yr · 4 visits/yr', 12, 4, 4, 459900, 'custom', 20),
  ('IN', 'kw_6', 'amc_kw6_y2_6', '6 kW AMC · 2 yr · 6 visits', 24, 6, null, 689900, 'custom', 30),
  ('IN', 'kw_8', 'amc_kw8_y1_3', '8 kW AMC · 1 yr · 3 visits/yr', 12, 3, 3, 429900, 'custom', 10),
  ('IN', 'kw_8', 'amc_kw8_y1_4', '8 kW AMC · 1 yr · 4 visits/yr', 12, 4, 4, 559900, 'custom', 20),
  ('IN', 'kw_8', 'amc_kw8_y2_6', '8 kW AMC · 2 yr · 6 visits', 24, 6, null, 849900, 'custom', 30),
  ('IN', 'kw_10', 'amc_kw10_y1_3', '10 kW AMC · 1 yr · 3 visits/yr', 12, 3, 3, 529900, 'custom', 10),
  ('IN', 'kw_10', 'amc_kw10_y1_4', '10 kW AMC · 1 yr · 4 visits/yr', 12, 4, 4, 689900, 'custom', 20),
  ('IN', 'kw_10', 'amc_kw10_y2_6', '10 kW AMC · 2 yr · 6 visits', 24, 6, null, 1099900, 'custom', 30)
on conflict (plan_code) do update set
  plan_name = excluded.plan_name,
  contract_months = excluded.contract_months,
  visits_included = excluded.visits_included,
  visits_per_year = excluded.visits_per_year,
  amount_cents = excluded.amount_cents,
  sort_order = excluded.sort_order;

-- ----- 20260622120000_auth_user_sync_role_on_conflict.sql -----
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone, role)
  values (
    new.id,
    nullif(lower(trim(coalesce(new.email, ''))), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', '')), ''),
    public.coerce_user_role(new.raw_user_meta_data->>'role')
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.users.email),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    phone = coalesce(excluded.phone, public.users.phone),
    role = coalesce(excluded.role, public.users.role),
    updated_at = now();

return new;

end;

$$;

create or replace function public.customer_site_photo_can_read(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or split_part(object_path, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.bookings b
      join public.customers c on c.id = b.customer_id
      where c.user_id::text = split_part(object_path, '/', 1)
        and coalesce(nullif(trim(b.metadata->>'service_address_id'), ''), '') = split_part(object_path, '/', 2)
        and b.technician_id is not null
        and b.status in (
          'accepted'::public.booking_status,
          'in_progress'::public.booking_status,
          'completed'::public.booking_status
        )
        and (
          b.technician_id = public.my_technician_id()
          or (b.vendor_id is not null and b.vendor_id = public.my_vendor_id())
        )
    );

$$;

create or replace function public.customer_site_photo_can_write(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select split_part(object_path, '/', 1) = auth.uid()::text
    and exists (
      select 1
      from public.customers c
      where c.user_id = auth.uid()
        and exists (
          select 1
          from jsonb_array_elements(coalesce(c.metadata->'service_addresses', '[]'::jsonb)) elem
          where elem->>'id' = split_part(object_path, '/', 2)
        )
    );

$$;

grant execute on function public.customer_site_photo_can_read(text) to authenticated;

grant execute on function public.customer_site_photo_can_write(text) to authenticated;

comment on function public.customer_site_photo_can_read(text) is
  'Storage RLS: customer owns path; vendor/technician when booking accepted+ with technician assigned.';

-- ----- 20260623120000_analytics_views_security_invoker.sql -----
drop function if exists public.get_vendor_public_stats(uuid[]);

drop view if exists public.bookings_created_daily;

drop view if exists public.subscription_stats;

drop view if exists public.technician_stats;

drop view if exists public.vendor_stats;

drop view if exists public.revenue_stats;

drop view if exists public.booking_stats;

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

create view public.bookings_created_daily
with (security_invoker = true) as
select
  (b.created_at at time zone 'Asia/Kolkata')::date as day,
  count(*)::bigint as booking_count
from public.bookings b
group by 1;

comment on view public.booking_stats is
  'Booking lifecycle counts; respects bookings RLS (admin = platform totals).';

comment on view public.revenue_stats is
  'Payment revenue totals; respects payments RLS.';

comment on view public.vendor_stats is
  'Per-vendor metrics for admin/vendor; respects bookings RLS. Customers: use get_vendor_public_stats().';

comment on view public.technician_stats is
  'Per-technician metrics; respects bookings/job_reports RLS.';

comment on view public.subscription_stats is
  'AMC and upcoming subscription visits; respects subscriptions/bookings RLS.';

comment on view public.bookings_created_daily is
  'Daily booking volume (Asia/Kolkata); respects bookings RLS.';

grant select on public.booking_stats to authenticated;

grant select on public.revenue_stats to authenticated;

grant select on public.vendor_stats to authenticated;

grant select on public.technician_stats to authenticated;

grant select on public.subscription_stats to authenticated;

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

comment on function public.get_vendor_public_stats(uuid[]) is
  'Public vendor rating/job aggregates for marketplace (approved vendors). Admins may pass any vendor ids.';

grant execute on function public.get_vendor_public_stats(uuid[]) to authenticated;

-- ----- 20260715120000_customer_late_cancel_fee.sql -----
alter table public.platform_settings
  add column if not exists customer_late_cancel_fee_paise integer not null default 9900
    check (customer_late_cancel_fee_paise >= 0 and customer_late_cancel_fee_paise <= 1000000000);

comment on column public.platform_settings.customer_late_cancel_fee_paise is
  'INR paise applied when a customer cancels after the grace window (typically charged or netted at refund time by ops).';

-- ----- 20260716140000_vendor_approval_finalize_technician.sql -----
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

alter table public.technicians disable trigger technicians_guard_verification_writes;

do $$
declare
  r record;

begin
  for r in
    select t.id
    from public.technicians t
    where t.vendor_review_status = 'approved'
      and (
        t.verification_status is distinct from 'verified'::public.technician_verification_status
        or t.is_verified is distinct from true
        or t.employee_code is null
        or trim(t.employee_code) = ''
      )
  loop
    update public.technicians t
    set
      verification_status = 'verified'::public.technician_verification_status,
      is_verified = true,
      verification_reviewed_at = coalesce(
        t.verification_reviewed_at,
        t.vendor_reviewed_at,
        now()
      ),
      verification_rejection_reason = null,
      employee_code = coalesce(
        nullif(trim(t.employee_code), ''),
        public.generate_technician_employee_code()
      ),
      updated_at = now()
    where t.id = r.id;

end loop;

end;

$$;

alter table public.technicians enable trigger technicians_guard_verification_writes;

alter table public.technicians drop column if exists employer_registration_ref;

alter table public.technicians drop column if exists certifications;

-- ----- 20260717120000_subscription_visit_slots.sql -----
create table if not exists public.subscription_visit_slots (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  ideal_scheduled_start timestamptz not null,
  ideal_scheduled_end timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'completed', 'cancelled')),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, sequence)
);

create index if not exists subscription_visit_slots_subscription_id_idx
  on public.subscription_visit_slots (subscription_id);

create index if not exists subscription_visit_slots_booking_id_idx
  on public.subscription_visit_slots (booking_id)
  where booking_id is not null;

create or replace function public.touch_subscription_visit_slots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

return new;

end;

$$;

drop trigger if exists subscription_visit_slots_updated_at on public.subscription_visit_slots;

create trigger subscription_visit_slots_updated_at
before update on public.subscription_visit_slots
for each row execute function public.touch_subscription_visit_slots_updated_at();

insert into public.subscription_visit_slots (
  subscription_id,
  sequence,
  ideal_scheduled_start,
  ideal_scheduled_end,
  status
)
select
  s.id,
  gs.seq,
  s.starts_at + (gs.seq - 1) * (
    greatest(
      extract(epoch from (s.ends_at - s.starts_at)) / greatest(coalesce(s.visits_included, 1), 1),
      86400
    ) * interval '1 second'
  ),
  least(
    s.starts_at
      + (gs.seq - 1) * (
        greatest(
          extract(epoch from (s.ends_at - s.starts_at)) / greatest(coalesce(s.visits_included, 1), 1),
          86400
        ) * interval '1 second'
      )
      + interval '2 hours',
    s.ends_at
  ),
  'pending'
from public.subscriptions s
cross join lateral generate_series(1, greatest(coalesce(s.visits_included, 0), 0)) as gs(seq)
where coalesce(s.visits_included, 0) > 0
  and not exists (
    select 1
    from public.subscription_visit_slots v
    where v.subscription_id = s.id
  )
  and s.starts_at + (gs.seq - 1) * (
    greatest(
      extract(epoch from (s.ends_at - s.starts_at)) / greatest(coalesce(s.visits_included, 1), 1),
      86400
    ) * interval '1 second'
  ) < s.ends_at;

update public.subscription_visit_slots v
set
  booking_id = b.id,
  status = case
    when b.status in ('completed') then 'completed'
    when b.status = 'cancelled' then 'cancelled'
    else 'scheduled'
  end
from public.bookings b
where b.subscription_id = v.subscription_id
  and b.status <> 'cancelled'
  and v.booking_id is null
  and v.status = 'pending'
  and b.metadata is not null
  and (b.metadata ->> 'source') = 'subscription_amc'
  and (b.metadata ->> 'sequence') ~ '^[0-9]+$'
  and (b.metadata ->> 'sequence')::integer = v.sequence;

with ranked_bookings as (
  select
    b.id,
    b.subscription_id,
    b.status,
    row_number() over (
      partition by b.subscription_id
      order by b.scheduled_start asc, b.created_at asc
    ) as rn
  from public.bookings b
  where b.subscription_id is not null
    and b.status <> 'cancelled'
)
update public.subscription_visit_slots v
set
  booking_id = rb.id,
  status = case
    when rb.status in ('completed') then 'completed'
    else 'scheduled'
  end
from ranked_bookings rb
where rb.subscription_id = v.subscription_id
  and rb.rn = v.sequence
  and v.booking_id is null
  and v.status = 'pending';

update public.subscriptions s
set visits_used = sub.cnt
from (
  select subscription_id, count(*)::integer as cnt
  from public.subscription_visit_slots
  where status in ('scheduled', 'completed')
  group by subscription_id
) sub
where s.id = sub.subscription_id
  and s.visits_used < sub.cnt;

-- ----- 20260718120000_amc_slots_customer_scheduled_only.sql -----
update public.bookings b
set metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object('customer_scheduled_amc', true)
where b.subscription_id is not null
  and b.metadata is not null
  and b.metadata ? 'schedule_slot'
  and coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false) is distinct from true;

update public.subscription_visit_slots v
set
  booking_id = null,
  status = 'pending'
from public.bookings b
where v.booking_id = b.id
  and b.subscription_id is not null
  and b.status = 'confirmed'
  and coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false) is not true
  and not (b.metadata ? 'schedule_slot')
  and (
    coalesce(b.metadata ->> 'source', '') = 'subscription_amc'
    or coalesce(b.customer_notes, '') ilike '%Auto-scheduled%'
  );

update public.bookings b
set
  status = 'cancelled',
  cancelled_at = coalesce(b.cancelled_at, now()),
  cancellation_reason = coalesce(
    nullif(trim(b.cancellation_reason), ''),
    'Legacy auto-scheduled AMC visit removed - schedule each visit from your AMC plan.'
  ),
  metadata = coalesce(b.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'legacy_auto_amc_cancelled', true,
      'cancelled_reason_code', 'legacy_auto_amc_reset'
    )
where b.subscription_id is not null
  and b.status = 'confirmed'
  and coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false) is not true
  and not (b.metadata ? 'schedule_slot')
  and (
    coalesce(b.metadata ->> 'source', '') = 'subscription_amc'
    or coalesce(b.customer_notes, '') ilike '%Auto-scheduled%'
  );

update public.subscription_visit_slots v
set
  booking_id = b.id,
  status = case
    when b.status = 'completed' then 'completed'
    when b.status = 'cancelled' then 'cancelled'
    else 'scheduled'
  end
from public.bookings b
where b.subscription_id = v.subscription_id
  and b.status <> 'cancelled'
  and v.booking_id is distinct from b.id
  and (
    coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false)
    or b.metadata ? 'schedule_slot'
  )
  and b.metadata is not null
  and (b.metadata ->> 'sequence') ~ '^[0-9]+$'
  and (b.metadata ->> 'sequence')::integer = v.sequence;

update public.subscription_visit_slots
set booking_id = null
where status = 'pending'
  and booking_id is not null;

update public.subscriptions s
set visits_used = coalesce(sub.cnt, 0)
from (
  select
    v.subscription_id,
    count(*)::integer as cnt
  from public.subscription_visit_slots v
  join public.bookings b on b.id = v.booking_id
  where v.booking_id is not null
    and b.status <> 'cancelled'
    and (
      coalesce((b.metadata ->> 'customer_scheduled_amc')::boolean, false)
      or b.metadata ? 'schedule_slot'
    )
  group by v.subscription_id
) sub
where s.id = sub.subscription_id;

-- ----- 20260720120000_customer_site_activity.sql -----
create table if not exists public.customer_site_activity_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_address_id text not null,
  kind text not null,
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  booking_id uuid references public.bookings (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint customer_site_activity_events_dedupe unique (customer_id, dedupe_key)
);

create index if not exists customer_site_activity_events_address_time_idx
  on public.customer_site_activity_events (customer_id, service_address_id, occurred_at desc);

create index if not exists customer_site_activity_events_booking_idx
  on public.customer_site_activity_events (booking_id)
  where booking_id is not null;

grant select, insert on public.customer_site_activity_events to authenticated;

create or replace function public.booking_metadata_service_address_id(meta jsonb)
returns text
language sql
immutable
as $$
  select nullif(trim(both from meta->>'service_address_id'), '');

$$;

create or replace function public.subscription_service_address_id(sub public.subscriptions)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both from sub.service_address_id), ''),
    public.booking_metadata_service_address_id(sub.metadata)
  );

$$;

create or replace function public.insert_customer_site_activity(
  p_customer_id uuid,
  p_service_address_id text,
  p_kind text,
  p_title text,
  p_summary text,
  p_occurred_at timestamptz,
  p_booking_id uuid,
  p_subscription_id uuid,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_service_address_id is null or length(trim(p_service_address_id)) = 0 then
    return;

end if;

insert into public.customer_site_activity_events (
    customer_id,
    service_address_id,
    kind,
    title,
    summary,
    occurred_at,
    booking_id,
    subscription_id,
    dedupe_key,
    payload
  )
  values (
    p_customer_id,
    trim(p_service_address_id),
    p_kind,
    p_title,
    p_summary,
    coalesce(p_occurred_at, now()),
    p_booking_id,
    p_subscription_id,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (customer_id, dedupe_key) do nothing;

end;

$$;

create or replace function public.log_customer_site_activity_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr_id text;

ref_code text;

base_payload jsonb;

begin
  addr_id := public.booking_metadata_service_address_id(new.metadata);

if addr_id is null then
    return new;

end if;

ref_code := coalesce(nullif(trim(both from new.reference_code), ''), new.id::text);

base_payload := jsonb_build_object(
    'reference_code', ref_code,
    'status', new.status,
    'scheduled_start', new.scheduled_start
  );

if tg_op = 'INSERT' then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'booking_created',
      'Booking placed',
      'Visit ' || ref_code || ' · ' || to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY'),
      coalesce(new.created_at, now()),
      new.id,
      new.subscription_id,
      'booking:' || new.id::text || ':created',
      base_payload
    );

return new;

end if;

if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_status_' || new.status,
        case new.status
          when 'pending_payment' then 'Awaiting payment'
          when 'confirmed' then 'Booking confirmed'
          when 'accepted' then 'Vendor accepted'
          when 'in_progress' then 'Technician on the way'
          when 'completed' then 'Visit completed'
          when 'cancelled' then 'Booking cancelled'
          else 'Booking updated'
        end,
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':status:' || new.status,
        base_payload || jsonb_build_object('previous_status', old.status)
      );

end if;

if old.technician_id is null and new.technician_id is not null then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_technician_assigned',
        'Technician assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':technician_assigned',
        base_payload || jsonb_build_object('technician_id', new.technician_id)
      );

end if;

end if;

return new;

end;

$$;

drop trigger if exists customer_site_activity_booking_trg on public.bookings;

create trigger customer_site_activity_booking_trg
after insert or update on public.bookings
for each row execute function public.log_customer_site_activity_from_booking();

create or replace function public.log_customer_site_activity_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr_id text;

begin
  addr_id := public.subscription_service_address_id(new);

if addr_id is null then
    return new;

end if;

if tg_op = 'INSERT' then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'amc_subscribed',
      'AMC plan started',
      coalesce(new.plan_name, new.plan_code) || ' · valid through ' ||
        to_char(new.ends_at at time zone 'Asia/Kolkata', 'Mon DD, YYYY'),
      coalesce(new.starts_at, new.created_at, now()),
      null,
      new.id,
      'subscription:' || new.id::text || ':created',
      jsonb_build_object(
        'plan_code', new.plan_code,
        'plan_name', new.plan_name,
        'visits_included', new.visits_included
      )
    );

return new;

end if;

if tg_op = 'UPDATE' and old.plan_code is distinct from new.plan_code then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'amc_upgraded',
      'AMC plan upgraded',
      coalesce(new.plan_name, new.plan_code) ||
        coalesce(' (was ' || old.plan_name || ')', ''),
      coalesce(new.updated_at, now()),
      null,
      new.id,
      'subscription:' || new.id::text || ':plan:' || new.plan_code,
      jsonb_build_object(
        'plan_code', new.plan_code,
        'previous_plan_code', old.plan_code
      )
    );

end if;

return new;

end;

$$;

drop trigger if exists customer_site_activity_subscription_trg on public.subscriptions;

create trigger customer_site_activity_subscription_trg
after insert or update on public.subscriptions
for each row execute function public.log_customer_site_activity_from_subscription();

create or replace function public.log_customer_site_activity_from_visit_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.subscriptions;

addr_id text;

ref_code text;

begin
  if tg_op <> 'UPDATE' then
    return new;

end if;

if old.booking_id is not null or new.booking_id is null then
    return new;

end if;

select * into sub from public.subscriptions s where s.id = new.subscription_id;

if not found then
    return new;

end if;

addr_id := public.subscription_service_address_id(sub);

if addr_id is null then
    return new;

end if;

select coalesce(nullif(trim(both from b.reference_code), ''), new.booking_id::text)
  into ref_code
  from public.bookings b
  where b.id = new.booking_id;

perform public.insert_customer_site_activity(
    sub.customer_id,
    addr_id,
    'amc_visit_scheduled',
    'AMC visit scheduled',
    'Visit ' || coalesce(ref_code, '') || ' · slot ' || new.sequence::text,
    coalesce(new.updated_at, now()),
    new.booking_id,
    new.subscription_id,
    'visit_slot:' || new.id::text || ':scheduled',
    jsonb_build_object('sequence', new.sequence, 'reference_code', ref_code)
  );

return new;

end;

$$;

drop trigger if exists customer_site_activity_visit_slot_trg on public.subscription_visit_slots;

create trigger customer_site_activity_visit_slot_trg
after update on public.subscription_visit_slots
for each row execute function public.log_customer_site_activity_from_visit_slot();

insert into public.customer_site_activity_events (
  customer_id,
  service_address_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  subscription_id,
  dedupe_key,
  payload
)
select
  b.customer_id,
  public.booking_metadata_service_address_id(b.metadata),
  'booking_created',
  'Booking placed',
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  b.created_at,
  b.id,
  b.subscription_id,
  'booking:' || b.id::text || ':created',
  jsonb_build_object('reference_code', b.reference_code, 'status', b.status)
from public.bookings b
where public.booking_metadata_service_address_id(b.metadata) is not null
on conflict (customer_id, dedupe_key) do nothing;

insert into public.customer_site_activity_events (
  customer_id,
  service_address_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  subscription_id,
  dedupe_key,
  payload
)
select
  s.customer_id,
  public.subscription_service_address_id(s),
  'amc_subscribed',
  'AMC plan started',
  coalesce(s.plan_name, s.plan_code),
  coalesce(s.starts_at, s.created_at),
  null,
  s.id,
  'subscription:' || s.id::text || ':created',
  jsonb_build_object('plan_code', s.plan_code, 'plan_name', s.plan_name)
from public.subscriptions s
where public.subscription_service_address_id(s) is not null
on conflict (customer_id, dedupe_key) do nothing;

insert into public.customer_site_activity_events (
  customer_id,
  service_address_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  subscription_id,
  dedupe_key,
  payload
)
select
  b.customer_id,
  public.booking_metadata_service_address_id(b.metadata),
  'booking_status_' || b.status,
  case b.status
    when 'pending_payment' then 'Awaiting payment'
    when 'confirmed' then 'Booking confirmed'
    when 'accepted' then 'Vendor accepted'
    when 'in_progress' then 'Technician on the way'
    when 'completed' then 'Visit completed'
    when 'cancelled' then 'Booking cancelled'
    else 'Booking updated'
  end,
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  coalesce(b.updated_at, b.created_at),
  b.id,
  b.subscription_id,
  'booking:' || b.id::text || ':status:' || b.status,
  jsonb_build_object('reference_code', b.reference_code, 'status', b.status)
from public.bookings b
where public.booking_metadata_service_address_id(b.metadata) is not null
  and b.status <> 'pending_payment'
on conflict (customer_id, dedupe_key) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_site_activity_events'
  ) then
    alter publication supabase_realtime add table public.customer_site_activity_events;

end if;

end $$;

-- ----- 20260721120000_customer_support_chat.sql -----
create type public.support_conversation_status as enum ('intake', 'queued', 'active', 'resolved');

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  category_slug text not null,
  subcategory_slug text not null,
  status public.support_conversation_status not null default 'queued',
  subject text,
  details_text text not null,
  booking_id uuid references public.bookings (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  service_address_id text,
  assigned_admin_user_id uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_conversations_customer_idx
  on public.support_conversations (customer_id, last_message_at desc);

create index if not exists support_conversations_status_idx
  on public.support_conversations (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_user_id uuid references auth.users (id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'admin', 'system')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at asc);

create or replace function public.touch_support_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

return new;

end;

$$;

drop trigger if exists support_conversations_updated_at on public.support_conversations;

create trigger support_conversations_updated_at
before update on public.support_conversations
for each row execute function public.touch_support_conversation_updated_at();

create or replace function public.bump_support_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      status = case
        when new.sender_role = 'admin' and status in ('queued', 'intake') then 'active'::public.support_conversation_status
        else status
      end,
      assigned_admin_user_id = case
        when new.sender_role = 'admin' and assigned_admin_user_id is null then new.sender_user_id
        else assigned_admin_user_id
      end
  where id = new.conversation_id;

return new;

end;

$$;

drop trigger if exists support_messages_bump_conversation on public.support_messages;

create trigger support_messages_bump_conversation
after insert on public.support_messages
for each row execute function public.bump_support_conversation_last_message();

grant select, insert, update on public.support_conversations to authenticated;

grant select, insert on public.support_messages to authenticated;

create or replace function public.support_conversation_welcome_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_messages (conversation_id, sender_role, body)
  values (
    new.id,
    'system',
    'Thanks for the details. An OorjaMan support specialist will join this chat shortly. You can keep messaging here while you wait.'
  );

return new;

end;

$$;

drop trigger if exists support_conversation_welcome_trg on public.support_conversations;

create trigger support_conversation_welcome_trg
after insert on public.support_conversations
for each row execute function public.support_conversation_welcome_message();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;

end if;

if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_conversations'
  ) then
    alter publication supabase_realtime add table public.support_conversations;

end if;

end $$;

-- ----- 20260722120000_support_inactivity_close.sql -----
alter table public.support_conversations
  add column if not exists last_customer_message_at timestamptz,
  add column if not exists close_reason text;

comment on column public.support_conversations.close_reason is
  'inactive_timeout | resolved_by_admin | null while open';

update public.support_conversations
set last_customer_message_at = last_message_at
where last_customer_message_at is null;

create or replace function public.bump_support_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      last_customer_message_at = case
        when new.sender_role = 'customer' then new.created_at
        else last_customer_message_at
      end,
      status = case
        when new.sender_role = 'admin' and status in ('queued', 'intake') then 'active'::public.support_conversation_status
        else status
      end,
      assigned_admin_user_id = case
        when new.sender_role = 'admin' and assigned_admin_user_id is null then new.sender_user_id
        else assigned_admin_user_id
      end
  where id = new.conversation_id;

return new;

end;

$$;

create or replace function public.close_inactive_support_chats_for_customer(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;

rec record;

begin
  if p_customer_id is null or p_customer_id <> public.my_customer_id() and not public.is_admin() then
    return 0;

end if;

for rec in
    select c.id
    from public.support_conversations c
    where c.customer_id = p_customer_id
      and c.status in ('queued', 'active')
      and coalesce(c.last_customer_message_at, c.created_at)
        < now() - interval '30 minutes'
  loop
    update public.support_conversations
    set status = 'resolved',
        close_reason = 'inactive_timeout',
        updated_at = now()
    where id = rec.id;

insert into public.support_messages (conversation_id, sender_role, body)
    values (
      rec.id,
      'system',
      'This chat was closed after 30 minutes without a reply. Start a new conversation anytime if you still need help.'
    );

closed_count := closed_count + 1;

end loop;

return closed_count;

end;

$$;

grant execute on function public.close_inactive_support_chats_for_customer(uuid) to authenticated;

-- ----- 20260723120000_auth_user_verification_sync.sql -----
alter table public.users
  add column if not exists phone_verified_at timestamptz,
  add column if not exists email_verified_at timestamptz;

comment on column public.users.phone_verified_at is
  'Copied from auth.users.phone_confirmed_at when the phone is verified (OTP or admin seed).';

comment on column public.users.email_verified_at is
  'Copied from auth.users.email_confirmed_at when the email is verified.';

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

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_updated();

do $$
declare
  au auth.users;

begin
  for au in select u.* from auth.users u loop
    perform public.apply_auth_user_to_public_users(au);

end loop;

end;

$$;

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

-- ----- 20260724120000_notification_inbox_realtime.sql -----
alter table public.notification_events
  add column if not exists recipient_audience text not null default 'vendor'
    check (recipient_audience in ('admin', 'vendor')),
  add column if not exists read_at timestamptz;

comment on column public.notification_events.recipient_audience is
  'admin = Oorjaman ops portal; vendor = partner portal (recipient_vendor_id required).';

comment on column public.notification_events.read_at is
  'When the recipient dismissed / opened the in-app notification.';

update public.notification_events
set recipient_audience = 'vendor'
where recipient_vendor_id is not null;

create index if not exists notification_events_audience_created_idx
  on public.notification_events (recipient_audience, created_at desc);

create index if not exists notification_events_vendor_unread_idx
  on public.notification_events (recipient_vendor_id, created_at desc)
  where recipient_vendor_id is not null and read_at is null;

create index if not exists notification_events_admin_unread_idx
  on public.notification_events (created_at desc)
  where recipient_audience = 'admin' and read_at is null;

create or replace function public.mark_notification_read(p_event_id uuid)
returns public.notification_events
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.notification_events;

begin
  select * into row from public.notification_events where id = p_event_id;

if not found then
    raise exception 'notification not found';

end if;

if row.recipient_audience = 'admin' then
    if not public.is_admin() then
      raise exception 'not allowed';

end if;

elsif row.recipient_audience = 'vendor' then
    if row.recipient_vendor_id is distinct from public.my_vendor_id() then
      raise exception 'not allowed';

end if;

else
    raise exception 'invalid audience';

end if;

update public.notification_events
  set read_at = coalesce(read_at, now())
  where id = p_event_id
  returning * into row;

return row;

end;

$$;

revoke all on function public.mark_notification_read(uuid) from public;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read(p_audience text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;

begin
  if p_audience not in ('admin', 'vendor') then
    raise exception 'invalid audience';

end if;

if p_audience = 'admin' then
    if not public.is_admin() then
      raise exception 'not allowed';

end if;

update public.notification_events
    set read_at = coalesce(read_at, now())
    where recipient_audience = 'admin' and read_at is null;

else
    if not public.is_approved_vendor_user() then
      raise exception 'not allowed';

end if;

update public.notification_events
    set read_at = coalesce(read_at, now())
    where recipient_audience = 'vendor'
      and recipient_vendor_id = public.my_vendor_id()
      and read_at is null;

end if;

get diagnostics n = row_count;

return n;

end;

$$;

revoke all on function public.mark_all_notifications_read(text) from public;

grant execute on function public.mark_all_notifications_read(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notification_events'
  ) then
    alter publication supabase_realtime add table public.notification_events;

end if;

end;

$$;

insert into public.notification_templates (event_type, channel, template_key, subject, body)
values
  ('admin_marketplace_floated', 'in_app', 'default', 'Marketplace opened', 'A booking was floated to partner vendors.'),
  ('admin_booking_vendor_claimed', 'in_app', 'default', 'Vendor claimed booking', 'A partner claimed a marketplace booking.'),
  ('admin_booking_vendor_accepted', 'in_app', 'default', 'Technician assigned', 'A partner accepted a booking and assigned a technician.'),
  ('admin_booking_vendor_rejected', 'in_app', 'default', 'Vendor declined', 'A partner declined a booking request.'),
  ('admin_booking_needs_reassignment', 'in_app', 'default', 'Reassignment needed', 'A partner cancelled an accepted visit - assign a new vendor.'),
  ('admin_booking_technician_reassigned', 'in_app', 'default', 'Technician changed', 'A partner reassigned the technician on a visit.'),
  ('admin_booking_visit_started', 'in_app', 'default', 'Visit started', 'A field visit has started on site.'),
  ('admin_booking_visit_completed', 'in_app', 'default', 'Visit completed', 'A field visit was marked complete.'),
  ('admin_booking_cancelled', 'in_app', 'default', 'Booking cancelled', 'A booking was cancelled.'),
  ('vendor_booking_assigned', 'in_app', 'default', 'New booking assigned', 'Operations assigned a paid booking to your organisation.'),
  ('vendor_booking_visit_started', 'in_app', 'default', 'Visit started', 'Your technician started the visit on site.'),
  ('vendor_booking_visit_completed', 'in_app', 'default', 'Visit completed', 'Your technician completed the visit.')
on conflict (event_type, channel, template_key) do nothing;

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
select v.event_type, 'in_app', true, true
from (values
  ('admin_marketplace_floated'),
  ('admin_booking_vendor_claimed'),
  ('admin_booking_vendor_accepted'),
  ('admin_booking_vendor_rejected'),
  ('admin_booking_needs_reassignment'),
  ('admin_booking_technician_reassigned'),
  ('admin_booking_visit_started'),
  ('admin_booking_visit_completed'),
  ('admin_booking_cancelled'),
  ('vendor_booking_assigned'),
  ('vendor_booking_visit_started'),
  ('vendor_booking_visit_completed')
) as v(event_type)
on conflict (event_type, channel) do nothing;

-- ----- 20260725120000_support_desk_phase2.sql -----
create type public.support_conversation_priority as enum ('normal', 'high', 'urgent');

alter table public.support_conversations
  add column if not exists priority public.support_conversation_priority not null default 'normal',
  add column if not exists first_admin_reply_at timestamptz;

create index if not exists support_conversations_priority_idx
  on public.support_conversations (priority, last_message_at desc);

alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'admin', 'system', 'internal'));

create or replace function public.bump_support_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      last_customer_message_at = case
        when new.sender_role = 'customer' then new.created_at
        else last_customer_message_at
      end,
      status = case
        when new.sender_role = 'admin' and status in ('queued', 'intake') then 'active'::public.support_conversation_status
        else status
      end,
      assigned_admin_user_id = case
        when new.sender_role = 'admin' and assigned_admin_user_id is null then new.sender_user_id
        else assigned_admin_user_id
      end,
      first_admin_reply_at = case
        when new.sender_role = 'admin' and first_admin_reply_at is null then new.created_at
        else first_admin_reply_at
      end
  where id = new.conversation_id;

return new;

end;

$$;

create table if not exists public.support_macros (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category_slug text,
  owner_user_id uuid references auth.users (id) on delete cascade,
  is_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_macros_team_idx
  on public.support_macros (is_team, category_slug);

create index if not exists support_macros_owner_idx
  on public.support_macros (owner_user_id);

grant select, insert, update, delete on public.support_macros to authenticated;

insert into public.support_macros (title, body, category_slug, is_team, owner_user_id)
select v.title, v.body, v.category_slug, true, null
from (
  values
    (
      'Checking your booking',
      'Thanks for reaching out. I''m checking your booking details now and will update you in this chat shortly.',
      null
    ),
    (
      'AMC / subscription',
      'I''m reviewing your AMC subscription and visit schedule. I''ll confirm the next steps here in a moment.',
      null
    ),
    (
      'Need a few details',
      'To help you faster, could you share your booking reference (if you have one) or the date of your last visit?',
      null
    )
) as v(title, body, category_slug)
where not exists (select 1 from public.support_macros m where m.is_team and m.title = v.title);

-- ----- 20260726115900_user_role_add_support.sql -----
alter type public.user_role add value if not exists 'support';

-- ----- 20260726120000_support_desk_phase3_and_support_role.sql -----
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
    when 'support' then 'support'::public.user_role
    else 'customer'::public.user_role
  end;

end;

$$;

create table if not exists public.support_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_agents_user_id_idx on public.support_agents (user_id);

drop trigger if exists support_agents_assert_role on public.support_agents;

create trigger support_agents_assert_role
before insert or update on public.support_agents
for each row execute function public.assert_user_role_extension();

drop trigger if exists support_agents_set_updated_at on public.support_agents;

create trigger support_agents_set_updated_at
before update on public.support_agents
for each row execute function public.set_updated_at();

create or replace function public.assert_user_role_extension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;

begin
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

if tg_table_name = 'support_agents' and r <> 'support'::public.user_role then
    raise exception 'support_agents.user_id must reference users.role = support';

end if;

return new;

end;

$$;

$$;

$$;

grant execute on function public.is_support_agent() to authenticated;

grant execute on function public.is_support_desk_user() to authenticated;

grant select, insert, update on public.support_agents to authenticated;

do $enum$
begin
  create type public.support_resolution_tag as enum (
    'resolved',
    'escalated',
    'duplicate',
    'policy_limitation'
  );

exception
  when duplicate_object then null;

end $enum$;

alter table public.support_conversations
  add column if not exists resolution_tag public.support_resolution_tag,
  add column if not exists resolved_at timestamptz,
  add column if not exists csat_rating smallint,
  add column if not exists csat_comment text,
  add column if not exists csat_submitted_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_note text;

alter table public.support_conversations
  drop constraint if exists support_conversations_csat_rating_chk;

alter table public.support_conversations
  add constraint support_conversations_csat_rating_chk
  check (csat_rating is null or (csat_rating >= 1 and csat_rating <= 5));

alter table public.platform_settings
  add column if not exists support_desk_config jsonb not null default jsonb_build_object(
    'timezone', 'Asia/Kolkata',
    'weekdays', jsonb_build_array(1, 2, 3, 4, 5, 6),
    'open_time', '09:00',
    'close_time', '21:00',
    'outside_hours_message',
    'Thanks for reaching out. Our support team is available 9am-9pm IST. We have queued your message and will reply when we are back online.'
  );

create table if not exists public.support_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages (id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  byte_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists support_message_attachments_message_idx
  on public.support_message_attachments (message_id);

grant select, insert on public.support_message_attachments to authenticated;

create or replace function public.support_conversation_after_hours_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;

tz text;

local_ts timestamp;

dow int;

weekdays jsonb;

open_t time;

close_t time;

msg text;

begin
  cfg := (
    select ps.support_desk_config
    from public.platform_settings ps
    where ps.id = 1
  );

if cfg is null then
    return new;

end if;

tz := coalesce(cfg->>'timezone', 'Asia/Kolkata');

local_ts := (now() at time zone tz)::timestamp;

dow := extract(isodow from local_ts)::int;

weekdays := coalesce(cfg->'weekdays', '[]'::jsonb);

open_t := coalesce((cfg->>'open_time')::time, '09:00'::time);

close_t := coalesce((cfg->>'close_time')::time, '21:00'::time);

msg := coalesce(
    cfg->>'outside_hours_message',
    'Our support team will reply during business hours.'
  );

if not exists (
    select 1
    from jsonb_array_elements_text(weekdays) d
    where d::int = dow
  ) then
    insert into public.support_messages (conversation_id, sender_role, body)
    values (new.id, 'system', msg);

return new;

end if;

if local_ts::time < open_t or local_ts::time >= close_t then
    insert into public.support_messages (conversation_id, sender_role, body)
    values (new.id, 'system', msg);

end if;

return new;

end;

$$;

drop trigger if exists support_conversation_after_hours_trg on public.support_conversations;

create trigger support_conversation_after_hours_trg
after insert on public.support_conversations
for each row execute function public.support_conversation_after_hours_notice();

create or replace function public.get_support_desk_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;

begin
  if not public.is_support_desk_user() then
    return '{}'::jsonb;

end if;

select jsonb_build_object(
    'open_count',
    (select count(*)::int from public.support_conversations where status in ('queued', 'active')),
    'queued_count',
    (select count(*)::int from public.support_conversations where status = 'queued'),
    'unassigned_count',
    (
      select count(*)::int
      from public.support_conversations
      where status in ('queued', 'active')
        and assigned_admin_user_id is null
    ),
    'resolved_24h',
    (
      select count(*)::int
      from public.support_conversations
      where status = 'resolved'
        and coalesce(resolved_at, updated_at) >= now() - interval '24 hours'
    ),
    'avg_first_reply_minutes',
    (
      select round(avg(extract(epoch from (first_admin_reply_at - created_at)) / 60.0)::numeric, 1)
      from public.support_conversations
      where first_admin_reply_at is not null
        and created_at >= now() - interval '7 days'
    ),
    'avg_csat_7d',
    (
      select round(avg(csat_rating)::numeric, 2)
      from public.support_conversations
      where csat_rating is not null
        and csat_submitted_at >= now() - interval '7 days'
    ),
    'by_category',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('category_slug', category_slug, 'count', cnt) order by cnt desc)
        from (
          select category_slug, count(*)::int as cnt
          from public.support_conversations
          where status in ('queued', 'active')
          group by category_slug
          order by cnt desc
          limit 8
        ) x
      ),
      '[]'::jsonb
    )
  )
  into result;

return coalesce(result, '{}'::jsonb);

end;

$$;

grant execute on function public.get_support_desk_insights() to authenticated;

-- ----- 20260727120000_support_assignment_customer_notices.sql -----
create or replace function public.support_agent_public_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(sa.display_name), ''),
    nullif(trim(u.full_name), ''),
    'An OorjaMan support specialist'
  )
  from public.users u
  left join public.support_agents sa on sa.user_id = u.id
  where u.id = p_user_id;

$$;

grant execute on function public.support_agent_public_name(uuid) to authenticated;

create or replace function public.support_notify_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;

body text;

meta jsonb;

begin
  if new.assigned_admin_user_id is not distinct from old.assigned_admin_user_id then
    return new;

end if;

if new.assigned_admin_user_id is not null and old.assigned_admin_user_id is null then
    new_name := public.support_agent_public_name(new.assigned_admin_user_id);

body := new_name || ' has joined the chat.';

meta := jsonb_build_object(
      'event', 'agent_joined',
      'agent_user_id', new.assigned_admin_user_id,
      'agent_display_name', new_name
    );

elsif new.assigned_admin_user_id is not null
    and old.assigned_admin_user_id is not null
    and new.assigned_admin_user_id <> old.assigned_admin_user_id then
    new_name := public.support_agent_public_name(new.assigned_admin_user_id);

body := 'Your chat was transferred to ' || new_name || '.';

meta := jsonb_build_object(
      'event', 'agent_transferred',
      'agent_user_id', new.assigned_admin_user_id,
      'agent_display_name', new_name
    );

elsif new.assigned_admin_user_id is null and old.assigned_admin_user_id is not null then
    body := 'Waiting for the next available support specialist.';

meta := jsonb_build_object('event', 'agent_left_queue');

else
    return new;

end if;

insert into public.support_messages (conversation_id, sender_role, body, metadata)
  values (new.id, 'system', body, coalesce(meta, '{}'::jsonb));

return new;

end;

$$;

drop trigger if exists support_conversations_assignment_notice on public.support_conversations;

create trigger support_conversations_assignment_notice
after update of assigned_admin_user_id on public.support_conversations
for each row execute function public.support_notify_assignment_change();

-- ----- 20260728120000_support_conversation_audit.sql -----
alter table public.support_conversations
  add column if not exists resolved_by_user_id uuid references auth.users (id) on delete set null;

create index if not exists support_conversations_resolved_by_idx
  on public.support_conversations (resolved_by_user_id)
  where resolved_by_user_id is not null;

create table if not exists public.support_conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('desk', 'customer', 'system')),
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_conversation_events_conversation_idx
  on public.support_conversation_events (conversation_id, created_at asc);

grant select, insert on public.support_conversation_events to authenticated;

create or replace function public.support_log_conversation_event(
  p_conversation_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_event_type text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_conversation_events (
    conversation_id,
    actor_user_id,
    actor_role,
    event_type,
    summary,
    metadata
  )
  values (
    p_conversation_id,
    p_actor_user_id,
    p_actor_role,
    p_event_type,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  );

end;

$$;

grant execute on function public.support_log_conversation_event(uuid, uuid, text, text, text, jsonb) to authenticated;

create or replace function public.support_conversation_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.support_log_conversation_event(
    new.id,
    null,
    'system',
    'conversation_started',
    'Customer started a support conversation',
    jsonb_build_object('category_slug', new.category_slug, 'subcategory_slug', new.subcategory_slug)
  );

return new;

end;

$$;

drop trigger if exists support_conversation_created_event_trg on public.support_conversations;

create trigger support_conversation_created_event_trg
after insert on public.support_conversations
for each row execute function public.support_conversation_created_event();

create or replace function public.close_inactive_support_chats_for_customer(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;

rec record;

begin
  if p_customer_id is null or (p_customer_id <> public.my_customer_id() and not public.is_admin()) then
    return 0;

end if;

for rec in
    select c.id
    from public.support_conversations c
    where c.customer_id = p_customer_id
      and c.status in ('queued', 'active')
      and coalesce(c.last_customer_message_at, c.created_at)
        < now() - interval '30 minutes'
  loop
    update public.support_conversations
    set status = 'resolved',
        close_reason = 'inactive_timeout',
        resolved_at = now(),
        updated_at = now()
    where id = rec.id;

perform public.support_log_conversation_event(
      rec.id,
      null,
      'system',
      'auto_closed_inactivity',
      'Chat closed automatically after 30 minutes without a customer reply',
      '{}'::jsonb
    );

insert into public.support_messages (conversation_id, sender_role, body)
    values (
      rec.id,
      'system',
      'This chat was closed after 30 minutes without a reply. Start a new conversation anytime if you still need help.'
    );

closed_count := closed_count + 1;

end loop;

return closed_count;

end;

$$;

-- ----- 20260730130000_support_customer_unread.sql -----
alter table public.support_conversations
  add column if not exists customer_last_read_at timestamptz;

update public.support_conversations
set customer_last_read_at = coalesce(last_message_at, created_at)
where customer_last_read_at is null;

comment on column public.support_conversations.customer_last_read_at is
  'When the customer last viewed the thread; used for unread badge on mobile.';

create or replace function public.count_unread_support_messages_for_customer()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.support_messages m
  inner join public.support_conversations c on c.id = m.conversation_id
  where c.customer_id = public.my_customer_id()
    and m.sender_role in ('admin', 'system')
    and m.created_at > coalesce(c.customer_last_read_at, c.created_at);

$$;

comment on function public.count_unread_support_messages_for_customer() is
  'Unread agent/system messages across all conversations for the signed-in customer.';

create or replace function public.mark_support_conversation_read_by_customer(p_conversation_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.support_conversations;

begin
  if public.my_customer_id() is null then
    raise exception 'customer profile required';

end if;

update public.support_conversations
  set customer_last_read_at = now(),
      updated_at = now()
  where id = p_conversation_id
    and customer_id = public.my_customer_id()
  returning * into row;

if not found then
    raise exception 'conversation not found';

end if;

return row;

end;

$$;

grant execute on function public.count_unread_support_messages_for_customer() to authenticated;

grant execute on function public.mark_support_conversation_read_by_customer(uuid) to authenticated;

-- ----- 20260731120000_customer_expo_push.sql -----
create table if not exists public.customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'unknown')),
  app_slug text not null default 'customer-app',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists customer_push_tokens_customer_idx
  on public.customer_push_tokens (customer_id, updated_at desc);

grant select, insert, update, delete on public.customer_push_tokens to authenticated;

create table if not exists public.customer_push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  conversation_id uuid references public.support_conversations (id) on delete set null,
  message_id uuid references public.support_messages (id) on delete set null,
  event_type text not null default 'support_message',
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_push_outbox_status_idx
  on public.customer_push_outbox (status, next_attempt_at, created_at);

revoke all on public.customer_push_outbox from authenticated;

grant all on public.customer_push_outbox to service_role;

create or replace function public.upsert_customer_push_token(
  p_expo_push_token text,
  p_platform text default 'unknown'
)
returns public.customer_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;

row public.customer_push_tokens;

v_platform text;

begin
  if auth.uid() is null then
    raise exception 'sign in required';

end if;

v_customer_id := public.my_customer_id();

if v_customer_id is null then
    raise exception 'customer profile required';

end if;

v_platform := case
    when lower(coalesce(p_platform, '')) in ('ios', 'android') then lower(p_platform)
    else 'unknown'
  end;

insert into public.customer_push_tokens (
    user_id,
    customer_id,
    expo_push_token,
    platform,
    last_seen_at,
    updated_at
  )
  values (
    auth.uid(),
    v_customer_id,
    trim(p_expo_push_token),
    v_platform,
    now(),
    now()
  )
  on conflict (user_id, expo_push_token) do update
  set
    customer_id = excluded.customer_id,
    platform = excluded.platform,
    last_seen_at = now(),
    updated_at = now()
  returning * into row;

return row;

end;

$$;

grant execute on function public.upsert_customer_push_token(text, text) to authenticated;

create or replace function public.enqueue_customer_support_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

v_customer_id uuid;

v_title text;

v_body text;

v_event text;

v_agent_name text;

begin
  if new.sender_role not in ('admin', 'system') then
    return new;

end if;

select c.customer_id, cust.user_id
  into v_customer_id, v_user_id
  from public.support_conversations c
  inner join public.customers cust on cust.id = c.customer_id
  where c.id = new.conversation_id;

if v_user_id is null then
    return new;

end if;

v_event := coalesce(new.metadata ->> 'event', '');

v_agent_name := nullif(trim(coalesce(new.metadata ->> 'agent_display_name', '')), '');

if new.sender_role = 'system' and v_event = 'agent_joined' then
    v_title := 'OorjaMan support';

v_body := coalesce(v_agent_name, 'Support') || ' joined your chat';

elsif new.sender_role = 'system' and v_event = 'agent_transferred' then
    v_title := 'OorjaMan support';

v_body := 'Your chat was transferred to ' || coalesce(v_agent_name, 'another agent');

else
    v_title := 'New support message';

v_body := left(trim(new.body), 200);

if v_body = '' then
      v_body := 'You have a new reply from support';

end if;

end if;

insert into public.customer_push_outbox (
    user_id,
    customer_id,
    conversation_id,
    message_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    v_customer_id,
    new.conversation_id,
    new.id,
    'support_message',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'support_message',
      'conversationId', new.conversation_id,
      'messageId', new.id
    )
  );

return new;

end;

$$;

drop trigger if exists support_messages_enqueue_customer_push on public.support_messages;

create trigger support_messages_enqueue_customer_push
after insert on public.support_messages
for each row execute function public.enqueue_customer_support_push();

create extension if not exists pg_net with schema extensions;

create or replace function public.try_dispatch_customer_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;

v_secret text;

request_id bigint;

begin
  v_url := nullif(trim(current_setting('app.customer_push_function_url', true)), '');

if v_url is null then
    return NEW;

end if;

v_secret := nullif(trim(current_setting('app.push_dispatch_secret', true)), '');

select net.http_post(
    url := v_url,
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', v_secret
      )
    ),
    body := jsonb_build_object('outbox_id', NEW.id::text)
  )
  into request_id;

return NEW;

exception
  when others then
    return NEW;

end;

$$;

drop trigger if exists customer_push_outbox_try_dispatch on public.customer_push_outbox;

create trigger customer_push_outbox_try_dispatch
after insert on public.customer_push_outbox
for each row execute function public.try_dispatch_customer_push_outbox();

comment on function public.try_dispatch_customer_push_outbox() is
  'When app.customer_push_function_url is set (e.g. https://<ref>.supabase.co/functions/v1/send-customer-expo-push), dispatches push immediately via pg_net.';

-- ----- 20260732120000_support_technician_audience.sql -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_participant_audience') then
    create type public.support_participant_audience as enum ('customer', 'technician');

end if;

end $$;

alter table public.support_conversations
  add column if not exists participant_audience public.support_participant_audience not null default 'customer',
  add column if not exists technician_id uuid references public.technicians (id) on delete cascade,
  add column if not exists last_technician_message_at timestamptz,
  add column if not exists technician_last_read_at timestamptz;

alter table public.support_conversations
  alter column customer_id drop not null;

update public.support_conversations
set participant_audience = 'customer'
where participant_audience is null;

update public.support_conversations
set technician_last_read_at = coalesce(last_message_at, created_at)
where participant_audience = 'technician' and technician_last_read_at is null;

alter table public.support_conversations
  drop constraint if exists support_conversations_participant_check;

alter table public.support_conversations
  add constraint support_conversations_participant_check check (
    (
      participant_audience = 'customer'
      and customer_id is not null
      and technician_id is null
    )
    or (
      participant_audience = 'technician'
      and technician_id is not null
      and customer_id is null
    )
  );

create index if not exists support_conversations_technician_idx
  on public.support_conversations (technician_id, last_message_at desc);

create index if not exists support_conversations_audience_status_idx
  on public.support_conversations (participant_audience, status, last_message_at desc);

alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'technician', 'admin', 'system', 'internal'));

create or replace function public.bump_support_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      last_customer_message_at = case
        when new.sender_role = 'customer' then new.created_at
        else last_customer_message_at
      end,
      last_technician_message_at = case
        when new.sender_role = 'technician' then new.created_at
        else last_technician_message_at
      end,
      status = case
        when new.sender_role = 'admin' and status in ('queued', 'intake') then 'active'::public.support_conversation_status
        else status
      end,
      assigned_admin_user_id = case
        when new.sender_role = 'admin' and assigned_admin_user_id is null then new.sender_user_id
        else assigned_admin_user_id
      end,
      first_admin_reply_at = case
        when new.sender_role = 'admin' and first_admin_reply_at is null then new.created_at
        else first_admin_reply_at
      end
  where id = new.conversation_id;

return new;

end;

$$;

create or replace function public.count_unread_support_messages_for_technician()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.support_messages m
  inner join public.support_conversations c on c.id = m.conversation_id
  where c.technician_id = public.my_technician_id()
    and c.participant_audience = 'technician'
    and m.sender_role in ('admin', 'system')
    and m.created_at > coalesce(c.technician_last_read_at, c.created_at);

$$;

create or replace function public.mark_support_conversation_read_by_technician(p_conversation_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.support_conversations;

begin
  if public.my_technician_id() is null then
    raise exception 'technician profile required';

end if;

update public.support_conversations
  set technician_last_read_at = now(),
      updated_at = now()
  where id = p_conversation_id
    and technician_id = public.my_technician_id()
    and participant_audience = 'technician'
  returning * into row;

if not found then
    raise exception 'conversation not found';

end if;

return row;

end;

$$;

grant execute on function public.count_unread_support_messages_for_technician() to authenticated;

grant execute on function public.mark_support_conversation_read_by_technician(uuid) to authenticated;

create or replace function public.close_inactive_support_chats_for_technician(p_technician_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;

rec record;

begin
  if p_technician_id is null
    or (p_technician_id <> public.my_technician_id() and not public.is_admin() and not public.is_support_agent()) then
    return 0;

end if;

for rec in
    select c.id
    from public.support_conversations c
    where c.technician_id = p_technician_id
      and c.participant_audience = 'technician'
      and c.status in ('queued', 'active')
      and coalesce(c.last_technician_message_at, c.created_at) < now() - interval '30 minutes'
  loop
    update public.support_conversations
    set status = 'resolved',
        close_reason = 'inactive_timeout',
        updated_at = now()
    where id = rec.id;

insert into public.support_messages (conversation_id, sender_role, body)
    values (
      rec.id,
      'system',
      'This chat was closed after 30 minutes without a reply. Start a new conversation anytime if you still need help.'
    );

closed_count := closed_count + 1;

end loop;

return closed_count;

end;

$$;

grant execute on function public.close_inactive_support_chats_for_technician(uuid) to authenticated;

create or replace function public.support_conversation_welcome_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_messages (conversation_id, sender_role, body)
  values (
    new.id,
    'system',
    case
      when new.participant_audience = 'technician' then
        'Thanks for the details. OorjaMan field support will join this chat shortly. Keep messaging here while you wait.'
      else
        'Thanks for the details. An OorjaMan support specialist will join this chat shortly. You can keep messaging here while you wait.'
    end
  );

return new;

end;

$$;

create table if not exists public.technician_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'unknown')),
  app_slug text not null default 'technician-app',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists technician_push_tokens_technician_idx
  on public.technician_push_tokens (technician_id, updated_at desc);

grant select, insert, update, delete on public.technician_push_tokens to authenticated;

create table if not exists public.technician_push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  conversation_id uuid references public.support_conversations (id) on delete set null,
  message_id uuid references public.support_messages (id) on delete set null,
  event_type text not null default 'support_message',
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists technician_push_outbox_status_idx
  on public.technician_push_outbox (status, next_attempt_at, created_at);

revoke all on public.technician_push_outbox from authenticated;

grant all on public.technician_push_outbox to service_role;

create or replace function public.upsert_technician_push_token(
  p_expo_push_token text,
  p_platform text default 'unknown'
)
returns public.technician_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_technician_id uuid;

row public.technician_push_tokens;

v_platform text;

begin
  if auth.uid() is null then
    raise exception 'sign in required';

end if;

v_technician_id := public.my_technician_id();

if v_technician_id is null then
    raise exception 'technician profile required';

end if;

v_platform := case
    when lower(coalesce(p_platform, '')) in ('ios', 'android') then lower(p_platform)
    else 'unknown'
  end;

insert into public.technician_push_tokens (
    user_id,
    technician_id,
    expo_push_token,
    platform,
    last_seen_at,
    updated_at
  )
  values (
    auth.uid(),
    v_technician_id,
    trim(p_expo_push_token),
    v_platform,
    now(),
    now()
  )
  on conflict (user_id, expo_push_token) do update
  set
    technician_id = excluded.technician_id,
    platform = excluded.platform,
    last_seen_at = now(),
    updated_at = now()
  returning * into row;

return row;

end;

$$;

grant execute on function public.upsert_technician_push_token(text, text) to authenticated;

create or replace function public.enqueue_customer_support_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

v_customer_id uuid;

v_title text;

v_body text;

v_event text;

v_agent_name text;

v_audience public.support_participant_audience;

begin
  if new.sender_role not in ('admin', 'system') then
    return new;

end if;

select c.participant_audience, c.customer_id, cust.user_id
  into v_audience, v_customer_id, v_user_id
  from public.support_conversations c
  left join public.customers cust on cust.id = c.customer_id
  where c.id = new.conversation_id;

if v_audience <> 'customer' or v_user_id is null then
    return new;

end if;

v_event := coalesce(new.metadata ->> 'event', '');

v_agent_name := nullif(trim(coalesce(new.metadata ->> 'agent_display_name', '')), '');

if new.sender_role = 'system' and v_event = 'agent_joined' then
    v_title := 'OorjaMan support';

v_body := coalesce(v_agent_name, 'Support') || ' joined your chat';

elsif new.sender_role = 'system' and v_event = 'agent_transferred' then
    v_title := 'OorjaMan support';

v_body := 'Your chat was transferred to ' || coalesce(v_agent_name, 'another agent');

else
    v_title := 'New support message';

v_body := left(trim(new.body), 200);

if v_body = '' then
      v_body := 'You have a new reply from support';

end if;

end if;

insert into public.customer_push_outbox (
    user_id,
    customer_id,
    conversation_id,
    message_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    v_customer_id,
    new.conversation_id,
    new.id,
    'support_message',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'support_message',
      'conversationId', new.conversation_id,
      'messageId', new.id
    )
  );

return new;

end;

$$;

create or replace function public.enqueue_technician_support_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

v_technician_id uuid;

v_title text;

v_body text;

v_event text;

v_agent_name text;

v_audience public.support_participant_audience;

begin
  if new.sender_role not in ('admin', 'system') then
    return new;

end if;

select c.participant_audience, c.technician_id, t.user_id
  into v_audience, v_technician_id, v_user_id
  from public.support_conversations c
  left join public.technicians t on t.id = c.technician_id
  where c.id = new.conversation_id;

if v_audience <> 'technician' or v_user_id is null then
    return new;

end if;

v_event := coalesce(new.metadata ->> 'event', '');

v_agent_name := nullif(trim(coalesce(new.metadata ->> 'agent_display_name', '')), '');

if new.sender_role = 'system' and v_event = 'agent_joined' then
    v_title := 'OorjaMan support';

v_body := coalesce(v_agent_name, 'Support') || ' joined your chat';

elsif new.sender_role = 'system' and v_event = 'agent_transferred' then
    v_title := 'OorjaMan support';

v_body := 'Your chat was transferred to ' || coalesce(v_agent_name, 'another agent');

else
    v_title := 'New support message';

v_body := left(trim(new.body), 200);

if v_body = '' then
      v_body := 'You have a new reply from support';

end if;

end if;

insert into public.technician_push_outbox (
    user_id,
    technician_id,
    conversation_id,
    message_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    v_technician_id,
    new.conversation_id,
    new.id,
    'support_message',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'support_message',
      'conversationId', new.conversation_id,
      'messageId', new.id
    )
  );

return new;

end;

$$;

drop trigger if exists support_messages_enqueue_technician_push on public.support_messages;

create trigger support_messages_enqueue_technician_push
after insert on public.support_messages
for each row execute function public.enqueue_technician_support_push();

create or replace function public.try_dispatch_technician_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;

v_secret text;

request_id bigint;

begin
  v_url := nullif(trim(current_setting('app.technician_push_function_url', true)), '');

if v_url is null then
    return NEW;

end if;

v_secret := nullif(trim(current_setting('app.push_dispatch_secret', true)), '');

select net.http_post(
    url := v_url,
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', v_secret
      )
    ),
    body := jsonb_build_object('outbox_id', NEW.id::text)
  )
  into request_id;

return NEW;

exception
  when others then
    return NEW;

end;

$$;

drop trigger if exists technician_push_outbox_try_dispatch on public.technician_push_outbox;

create trigger technician_push_outbox_try_dispatch
after insert on public.technician_push_outbox
for each row execute function public.try_dispatch_technician_push_outbox();

-- ----- 20260733120000_technician_activity_events.sql -----
create table if not exists public.technician_activity_events (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  kind text not null,
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  booking_id uuid references public.bookings (id) on delete set null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint technician_activity_events_dedupe unique (technician_id, dedupe_key)
);

create index if not exists technician_activity_events_tech_time_idx
  on public.technician_activity_events (technician_id, occurred_at desc);

create index if not exists technician_activity_events_booking_idx
  on public.technician_activity_events (booking_id)
  where booking_id is not null;

grant select on public.technician_activity_events to authenticated;

create or replace function public.insert_technician_activity(
  p_technician_id uuid,
  p_kind text,
  p_title text,
  p_summary text,
  p_occurred_at timestamptz,
  p_booking_id uuid,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_technician_id is null then
    return;

end if;

insert into public.technician_activity_events (
    technician_id,
    kind,
    title,
    summary,
    occurred_at,
    booking_id,
    dedupe_key,
    payload
  )
  values (
    p_technician_id,
    p_kind,
    p_title,
    p_summary,
    coalesce(p_occurred_at, now()),
    p_booking_id,
    p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (technician_id, dedupe_key) do nothing;

end;

$$;

create or replace function public.log_technician_activity_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;

base_payload jsonb;

begin
  ref_code := coalesce(nullif(trim(both from new.reference_code), ''), new.id::text);

base_payload := jsonb_build_object(
    'reference_code', ref_code,
    'status', new.status,
    'scheduled_start', new.scheduled_start
  );

if tg_op = 'INSERT' then
    if new.technician_id is not null then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_assigned',
        'New job assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, new.created_at, now()),
        new.id,
        'booking:' || new.id::text || ':assigned:' || new.technician_id::text,
        base_payload
      );

end if;

return new;

end if;

if tg_op = 'UPDATE' then
    if old.technician_id is not null and old.technician_id is distinct from new.technician_id then
      perform public.insert_technician_activity(
        old.technician_id,
        'job_unassigned',
        'Assignment removed',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':unassigned:' || old.technician_id::text,
        base_payload
      );

end if;

if new.technician_id is not null
      and (old.technician_id is null or old.technician_id is distinct from new.technician_id) then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_assigned',
        'New job assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':assigned:' || new.technician_id::text,
        base_payload
      );

end if;

if new.technician_id is not null and old.status is distinct from new.status then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_status_' || new.status,
        case new.status
          when 'accepted' then 'Job accepted'
          when 'in_progress' then 'Job started'
          when 'completed' then 'Job finished'
          when 'cancelled' then 'Job cancelled'
          when 'confirmed' then 'Visit confirmed'
          when 'pending_payment' then 'Awaiting payment'
          else 'Job updated'
        end,
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':status:' || new.status,
        base_payload || jsonb_build_object('previous_status', old.status)
      );

end if;

if new.technician_id is not null
      and old.scheduled_start is distinct from new.scheduled_start then
      perform public.insert_technician_activity(
        new.technician_id,
        'job_rescheduled',
        'Visit rescheduled',
        to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY · HH12:MI AM'),
        coalesce(new.updated_at, now()),
        new.id,
        'booking:' || new.id::text || ':reschedule:' || new.scheduled_start::text,
        base_payload
      );

end if;

end if;

return new;

end;

$$;

drop trigger if exists technician_activity_booking_trg on public.bookings;

create trigger technician_activity_booking_trg
after insert or update on public.bookings
for each row execute function public.log_technician_activity_from_booking();

create or replace function public.log_technician_activity_from_job_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;

begin
  if tg_op <> 'UPDATE' or new.technician_id is null then
    return new;

end if;

if old.customer_rating is not distinct from new.customer_rating or new.customer_rating is null then
    return new;

end if;

select coalesce(nullif(trim(both from b.reference_code), ''), new.booking_id::text)
  into ref_code
  from public.bookings b
  where b.id = new.booking_id;

perform public.insert_technician_activity(
    new.technician_id,
    'customer_rating_received',
    'Customer rated visit',
    'Visit ' || coalesce(ref_code, '') || ' · ' || new.customer_rating::text || ' / 5',
    coalesce(new.updated_at, now()),
    new.booking_id,
    'job_report:' || new.id::text || ':rating:' || new.customer_rating::text,
    jsonb_build_object(
      'reference_code', ref_code,
      'customer_rating', new.customer_rating,
      'booking_id', new.booking_id
    )
  );

return new;

end;

$$;

drop trigger if exists technician_activity_job_report_trg on public.job_reports;

create trigger technician_activity_job_report_trg
after update on public.job_reports
for each row execute function public.log_technician_activity_from_job_report();

insert into public.technician_activity_events (
  technician_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  dedupe_key,
  payload
)
select
  b.technician_id,
  'job_assigned',
  'New job assigned',
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  coalesce(b.updated_at, b.created_at),
  b.id,
  'booking:' || b.id::text || ':assigned:' || b.technician_id::text,
  jsonb_build_object(
    'reference_code', b.reference_code,
    'status', b.status,
    'scheduled_start', b.scheduled_start
  )
from public.bookings b
where b.technician_id is not null
on conflict (technician_id, dedupe_key) do nothing;

insert into public.technician_activity_events (
  technician_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  dedupe_key,
  payload
)
select
  b.technician_id,
  'job_status_' || b.status,
  case b.status
    when 'accepted' then 'Job accepted'
    when 'in_progress' then 'Job started'
    when 'completed' then 'Job finished'
    when 'cancelled' then 'Job cancelled'
    when 'confirmed' then 'Visit confirmed'
    else 'Job updated'
  end,
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), b.id::text),
  coalesce(b.updated_at, b.created_at),
  b.id,
  'booking:' || b.id::text || ':status:' || b.status,
  jsonb_build_object(
    'reference_code', b.reference_code,
    'status', b.status,
    'scheduled_start', b.scheduled_start
  )
from public.bookings b
where b.technician_id is not null
  and b.status in ('accepted', 'in_progress', 'completed', 'cancelled', 'confirmed')
on conflict (technician_id, dedupe_key) do nothing;

insert into public.technician_activity_events (
  technician_id,
  kind,
  title,
  summary,
  occurred_at,
  booking_id,
  dedupe_key,
  payload
)
select
  jr.technician_id,
  'customer_rating_received',
  'Customer rated visit',
  'Visit ' || coalesce(nullif(trim(both from b.reference_code), ''), jr.booking_id::text)
    || ' · ' || jr.customer_rating::text || ' / 5',
  coalesce(jr.updated_at, jr.created_at),
  jr.booking_id,
  'job_report:' || jr.id::text || ':rating:' || jr.customer_rating::text,
  jsonb_build_object(
    'reference_code', b.reference_code,
    'customer_rating', jr.customer_rating,
    'booking_id', jr.booking_id
  )
from public.job_reports jr
join public.bookings b on b.id = jr.booking_id
where jr.technician_id is not null
  and jr.customer_rating is not null
on conflict (technician_id, dedupe_key) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'technician_activity_events'
  ) then
    alter publication supabase_realtime add table public.technician_activity_events;

end if;

end $$;

-- ----- 20260733130000_customer_activity_enhancements.sql -----
create or replace function public.log_customer_site_activity_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr_id text;

ref_code text;

base_payload jsonb;

begin
  addr_id := public.booking_metadata_service_address_id(new.metadata);

if addr_id is null then
    return new;

end if;

ref_code := coalesce(nullif(trim(both from new.reference_code), ''), new.id::text);

base_payload := jsonb_build_object(
    'reference_code', ref_code,
    'status', new.status,
    'scheduled_start', new.scheduled_start
  );

if tg_op = 'INSERT' then
    perform public.insert_customer_site_activity(
      new.customer_id,
      addr_id,
      'booking_created',
      'Booking placed',
      'Visit ' || ref_code || ' · ' || to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY'),
      coalesce(new.created_at, now()),
      new.id,
      new.subscription_id,
      'booking:' || new.id::text || ':created',
      base_payload
    );

return new;

end if;

if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_status_' || new.status,
        case new.status
          when 'pending_payment' then 'Awaiting payment'
          when 'confirmed' then 'Booking confirmed'
          when 'accepted' then 'Vendor accepted'
          when 'in_progress' then 'Technician on the way'
          when 'completed' then 'Visit completed'
          when 'cancelled' then 'Booking cancelled'
          else 'Booking updated'
        end,
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':status:' || new.status,
        base_payload || jsonb_build_object('previous_status', old.status)
      );

end if;

if old.technician_id is null and new.technician_id is not null then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_technician_assigned',
        'Technician assigned',
        'Visit ' || ref_code,
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':technician_assigned',
        base_payload || jsonb_build_object('technician_id', new.technician_id)
      );

end if;

if old.scheduled_start is distinct from new.scheduled_start then
      perform public.insert_customer_site_activity(
        new.customer_id,
        addr_id,
        'booking_rescheduled',
        'Visit rescheduled',
        to_char(new.scheduled_start at time zone 'Asia/Kolkata', 'Mon DD, YYYY · HH12:MI AM'),
        coalesce(new.updated_at, now()),
        new.id,
        new.subscription_id,
        'booking:' || new.id::text || ':reschedule:' || new.scheduled_start::text,
        base_payload
      );

end if;

end if;

return new;

end;

$$;

create or replace function public.log_customer_site_activity_from_job_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;

addr_id text;

ref_code text;

begin
  if tg_op <> 'UPDATE' then
    return new;

end if;

if old.customer_rating is not distinct from new.customer_rating or new.customer_rating is null then
    return new;

end if;

select * into b from public.bookings where id = new.booking_id;

if not found then
    return new;

end if;

addr_id := public.booking_metadata_service_address_id(b.metadata);

if addr_id is null then
    return new;

end if;

ref_code := coalesce(nullif(trim(both from b.reference_code), ''), b.id::text);

perform public.insert_customer_site_activity(
    b.customer_id,
    addr_id,
    'customer_rating_submitted',
    'You rated this visit',
    ref_code || ' · ' || new.customer_rating::text || ' / 5',
    coalesce(new.updated_at, now()),
    b.id,
    b.subscription_id,
    'job_report:' || new.id::text || ':rating:' || new.customer_rating::text,
    jsonb_build_object(
      'reference_code', ref_code,
      'customer_rating', new.customer_rating,
      'booking_id', b.id
    )
  );

return new;

end;

$$;

drop trigger if exists customer_site_activity_job_report_trg on public.job_reports;

create trigger customer_site_activity_job_report_trg
after update on public.job_reports
for each row execute function public.log_customer_site_activity_from_job_report();

-- ----- 20260733140000_users_full_name_backfill.sql -----
update public.users u
set
  full_name = trim(c.display_name),
  updated_at = now()
from public.customers c
where c.user_id = u.id
  and nullif(trim(c.display_name), '') is not null;

update public.users u
set
  full_name = trim(t.name_as_per_aadhaar),
  updated_at = now()
from public.technicians t
where t.user_id = u.id
  and nullif(trim(t.name_as_per_aadhaar), '') is not null;

update public.users u
set
  full_name = coalesce(nullif(trim(v.trade_name), ''), nullif(trim(v.business_name), '')),
  updated_at = now()
from public.vendors v
where v.user_id = u.id
  and coalesce(nullif(trim(v.trade_name), ''), nullif(trim(v.business_name), '')) is not null;

update public.users u
set
  full_name = trim(sa.display_name),
  updated_at = now()
from public.support_agents sa
where sa.user_id = u.id
  and nullif(trim(sa.display_name), '') is not null;

-- ----- 20260733150000_vendor_intake_submit_required_fields.sql -----
create or replace function public.vendor_intake_form_text(p_form jsonb, p_key text)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(p_form ->> p_key, '')), '');

$$;

create or replace function public.vendor_intake_form_bool(p_form jsonb, p_key text)
returns boolean
language sql
immutable
as $$
  select coalesce((p_form ->> p_key)::boolean, false);

$$;

create or replace function public.vendor_intake_validate_submit_form(p_form jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_addr jsonb;

v_line1 text;

v_city text;

v_state text;

v_pin text;

v_years numeric;

v_workforce integer;

v_equipment text[];

v_regions text[];

v_areas text[];

v_pan text;

v_gstin text;

v_ifsc text;

v_bank_digits text;

begin
  if public.vendor_intake_form_text(p_form, 'business_name') is null then
    raise exception 'business_name is required';

end if;

if public.vendor_intake_form_text(p_form, 'partner_login_email') is null then
    raise exception 'partner_login_email is required';

end if;

if coalesce(
    public.vendor_intake_form_text(p_form, 'partner_login_phone_e164'),
    public.vendor_intake_form_text(p_form, 'partner_login_phone'),
    ''
  ) = '' then
    raise exception 'partner_login_phone is required';

end if;

if public.vendor_intake_form_text(p_form, 'trade_name') is null then
    raise exception 'trade_name is required';

end if;

if public.vendor_intake_form_text(p_form, 'company_type') is null then
    raise exception 'company_type is required';

end if;

if public.vendor_intake_form_text(p_form, 'company_registration_number') is null then
    raise exception 'company_registration_number is required';

end if;

v_gstin := upper(public.vendor_intake_form_text(p_form, 'gstin'));

if v_gstin is null or v_gstin !~ '^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$' then
    raise exception 'valid gstin is required';

end if;

v_pan := upper(public.vendor_intake_form_text(p_form, 'pan'));

if v_pan is null or v_pan !~ '^[A-Z]{5}\d{4}[A-Z]$' then
    raise exception 'valid pan is required';

end if;

if public.vendor_intake_form_text(p_form, 'website_url') is null then
    raise exception 'website_url is required';

end if;

if public.vendor_intake_form_text(p_form, 'contact_email') is null then
    raise exception 'contact_email is required';

end if;

if public.vendor_intake_form_text(p_form, 'contact_phone') is null then
    raise exception 'contact_phone is required';

end if;

if public.vendor_intake_form_text(p_form, 'contact_person_name') is null then
    raise exception 'contact_person_name is required';

end if;

if public.vendor_intake_form_text(p_form, 'contact_person_role') is null then
    raise exception 'contact_person_role is required';

end if;

if public.vendor_intake_form_text(p_form, 'contact_person_phone') is null then
    raise exception 'contact_person_phone is required';

end if;

if public.vendor_intake_form_text(p_form, 'contact_person_email') is null then
    raise exception 'contact_person_email is required';

end if;

v_addr := p_form -> 'registered_address';

if v_addr is null or jsonb_typeof(v_addr) <> 'object' then
    raise exception 'registered_address is required';

end if;

v_line1 := nullif(trim(coalesce(v_addr ->> 'line1', '')), '');

v_city := nullif(trim(coalesce(v_addr ->> 'city', '')), '');

v_state := nullif(trim(coalesce(v_addr ->> 'state', '')), '');

v_pin := regexp_replace(coalesce(v_addr ->> 'pincode', ''), '\D', '', 'g');

if v_line1 is null then
    raise exception 'registered_address.line1 is required';

end if;

if v_city is null then
    raise exception 'registered_address.city is required';

end if;

if v_state is null then
    raise exception 'registered_address.state is required';

end if;

if length(v_pin) <> 6 then
    raise exception 'registered_address.pincode must be 6 digits';

end if;

v_regions := coalesce(
    (
      select array_agg(trim(x))
      from unnest(
        regexp_split_to_array(
          coalesce(public.vendor_intake_form_text(p_form, 'operating_regions_text'), ''),
          '[,;\n]+'
        )
      ) as x
      where trim(x) <> ''
    ),
    '{}'::text[]
  );

if coalesce(array_length(v_regions, 1), 0) = 0 then
    v_regions := coalesce(
      (
        select array_agg(trim(x))
        from jsonb_array_elements_text(coalesce(p_form -> 'operating_regions', '[]'::jsonb)) as x
        where trim(x) <> ''
      ),
      '{}'::text[]
    );

end if;

if coalesce(array_length(v_regions, 1), 0) = 0 then
    raise exception 'operating_regions is required';

end if;

v_areas := coalesce(
    (
      select array_agg(trim(x))
      from unnest(
        regexp_split_to_array(
          coalesce(public.vendor_intake_form_text(p_form, 'service_areas_text'), ''),
          '[,;\n]+'
        )
      ) as x
      where trim(x) <> ''
    ),
    '{}'::text[]
  );

if coalesce(array_length(v_areas, 1), 0) = 0 then
    v_areas := coalesce(
      (
        select array_agg(trim(x))
        from jsonb_array_elements_text(coalesce(p_form -> 'service_areas', '[]'::jsonb)) as x
        where trim(x) <> ''
      ),
      '{}'::text[]
    );

end if;

if coalesce(array_length(v_areas, 1), 0) = 0 then
    raise exception 'service_areas is required';

end if;

begin
    v_years := nullif(trim(coalesce(p_form ->> 'years_in_business', '')), '')::numeric;

exception
    when others then
      raise exception 'years_in_business must be a number';

end;

if v_years is null or v_years <= 0 then
    raise exception 'years_in_business is required';

end if;

begin
    v_workforce := nullif(trim(coalesce(p_form ->> 'workforce_headcount', '')), '')::integer;

exception
    when others then
      raise exception 'workforce_headcount must be a whole number';

end;

if v_workforce is null or v_workforce <= 0 then
    raise exception 'workforce_headcount is required';

end if;

if public.vendor_intake_form_text(p_form, 'experience_summary') is null then
    raise exception 'experience_summary is required';

end if;

v_equipment := coalesce(
    (
      select array_agg(trim(x))
      from unnest(
        regexp_split_to_array(
          coalesce(public.vendor_intake_form_text(p_form, 'equipment_text'), ''),
          '[,;\n]+'
        )
      ) as x
      where trim(x) <> ''
    ),
    '{}'::text[]
  );

if coalesce(array_length(v_equipment, 1), 0) = 0 then
    v_equipment := coalesce(
      (
        select array_agg(trim(x))
        from jsonb_array_elements_text(coalesce(p_form -> 'equipment_available', '[]'::jsonb)) as x
        where trim(x) <> ''
      ),
      '{}'::text[]
    );

end if;

if coalesce(array_length(v_equipment, 1), 0) = 0 then
    raise exception 'equipment_available is required';

end if;

if not public.vendor_intake_form_bool(p_form, 'flag_safety_training') then
    raise exception 'flag_safety_training must be true';

end if;

if not public.vendor_intake_form_bool(p_form, 'flag_ppe_available') then
    raise exception 'flag_ppe_available must be true';

end if;

if not public.vendor_intake_form_bool(p_form, 'flag_insurance_coverage') then
    raise exception 'flag_insurance_coverage must be true';

end if;

if public.vendor_intake_form_text(p_form, 'bank_name') is null then
    raise exception 'bank_name is required';

end if;

v_ifsc := upper(regexp_replace(coalesce(public.vendor_intake_form_text(p_form, 'bank_ifsc'), ''), '\s', '', 'g'));

if v_ifsc is null or v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'valid bank_ifsc is required';

end if;

v_bank_digits := regexp_replace(coalesce(public.vendor_intake_form_text(p_form, 'bank_account_number'), ''), '\D', '', 'g');

if length(v_bank_digits) < 9 then
    raise exception 'bank_account_number is required';

end if;

if public.vendor_intake_form_text(p_form, 'doc_pan_url') is null then
    raise exception 'doc_pan_url is required';

end if;

if public.vendor_intake_form_text(p_form, 'doc_aadhaar_url') is null then
    raise exception 'doc_aadhaar_url is required';

end if;

if public.vendor_intake_form_text(p_form, 'doc_gst_url') is null then
    raise exception 'doc_gst_url is required';

end if;

if public.vendor_intake_form_text(p_form, 'doc_bank_proof_url') is null then
    raise exception 'doc_bank_proof_url is required';

end if;

end;

$$;

create or replace function public.submit_vendor_registration_intake (p_id uuid, p_token uuid, p_form jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;

v_phone text;

v_business text;

begin
  perform public.vendor_intake_validate_submit_form(p_form);

v_email := nullif(
    trim(
      coalesce(
        p_form ->> 'partner_login_email',
        p_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );

v_phone := nullif(
    trim(coalesce(p_form ->> 'partner_login_phone_e164', p_form ->> 'partner_login_phone', '')),
    ''
  );

v_business := left(trim(coalesce(p_form ->> 'business_name', '')), 200);

update public.vendor_registration_intake
  set
    form_data = coalesce(p_form, '{}'::jsonb),
    step_index = greatest (0, step_index),
    business_name = v_business,
    contact_email = v_email,
    contact_phone = v_phone,
    status = 'submitted',
    submitted_at = now ()
  where
    id = p_id
    and draft_access_token = p_token
    and status = 'draft';

if not found then
    raise exception 'Invalid intake, wrong token, or intake is not editable';

end if;

end;

$$;

-- ----- 20260733170000_oorjaman_notification_template_voice.sql -----
update public.notification_templates
set
  subject = 'New solar visit on OorjaMan marketplace',
  body = 'Visit {{reference_code}} is open in your service area. Claiming quickly helps homeowners get timely panel care - thank you for showing up for them.',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'A homeowner needs you - {{reference_code}}',
  body = 'Namaste,

A new OorjaMan marketplace visit ({{reference_code}}) matches your service area. When you claim it, the customer sees that help is on the way - your response time truly matters for their peace of mind.

Open your partner dashboard to review slot and site details.

With gratitude,
Team OorjaMan',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'email' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan: Visit {{reference_code}} is open to claim on the partner marketplace. Timely claims keep customers'' solar care on track.',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'sms' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan marketplace - visit {{reference_code}} is ready for your team to claim. Homeowners count on partners who respond with care.',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'whatsapp' and template_key = 'default';

update public.notification_templates
set
  subject = 'You secured the visit',
  body = 'Well done - you claimed {{reference_code}} on OorjaMan. Please assign your technician and confirm the slot so the customer knows their panels are in good hands.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Claim confirmed - {{reference_code}}',
  body = 'Your organisation has secured marketplace visit {{reference_code}}. Assign your best crew and confirm timing - we''re grateful for the trust you place in OorjaMan.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'email' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan: Claim confirmed for {{reference_code}}. Assign technician and confirm slot.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'sms' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan - you claimed visit {{reference_code}}. Assign your technician when ready; the homeowner will be notified.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'whatsapp' and template_key = 'default';

update public.notification_templates
set
  subject = '{{customer_name}}, your OorjaMan solar care plan',
  body = 'Namaste {{customer_name}},

{{renewal_intro}}

{{renewal_cta}}

If you have already renewed, please accept our thanks and ignore this note - we are grateful for your trust.

- Team OorjaMan',
  updated_at = now()
where event_type = 'subscription_renewal_nudge' and channel = 'email' and template_key = 'sub_renewal_email_v1';

update public.notification_templates
set
  body = 'OorjaMan: {{renewal_intro}} {{renewal_cta}} Already renewed? Thank you - no action needed.',
  updated_at = now()
where event_type = 'subscription_renewal_nudge' and channel = 'sms' and template_key = 'sub_renewal_sms_v1';

update public.notification_templates
set
  body = 'Namaste {{customer_name}}, from OorjaMan - {{renewal_intro}} {{renewal_cta}} If you''ve renewed already, thank you and please ignore.',
  updated_at = now()
where event_type = 'subscription_renewal_nudge' and channel = 'whatsapp' and template_key = 'sub_renewal_whatsapp_v1';

update public.notification_templates
set
  subject = 'Please care for {{reference_code}} - {{rating}}/5 rating',
  body = 'A customer rated visit {{reference_code}} at {{rating}}/5.

Their words: "{{feedback}}"

We would be grateful if you read this with humility and reach out sincerely - a short call to listen often restores trust and helps us serve their home better.

- OorjaMan operations',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'email' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan: {{reference_code}} rated {{rating}}/5. Please read feedback and follow up with care.',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'sms' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan ops - {{reference_code}} received {{rating}}/5. Customer feedback: "{{feedback}}". A humble follow-up call is appreciated.',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'whatsapp' and template_key = 'default';

update public.notification_templates
set
  subject = 'Customer deserves a caring follow-up',
  body = 'Booking {{reference_code}} was rated {{rating}}/5. Please read their feedback and reach out with humility - your personal touch keeps OorjaMan trustworthy.',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Marketplace is live',
  body = 'A booking was floated to trusted OorjaMan partners - the customer''s visit can be claimed or assigned from bookings.',
  updated_at = now()
where event_type = 'admin_marketplace_floated' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Partner claimed visit',
  body = 'A partner claimed a marketplace booking - review acceptance and crew assignment when you have a moment.',
  updated_at = now()
where event_type = 'admin_booking_vendor_claimed' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Crew assigned',
  body = 'A partner accepted a booking and assigned a technician - the homeowner can track progress in the OorjaMan app.',
  updated_at = now()
where event_type = 'admin_booking_vendor_accepted' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Partner could not take visit',
  body = 'A partner declined a booking - a quick reassignment keeps the customer''s solar care on schedule.',
  updated_at = now()
where event_type = 'admin_booking_vendor_rejected' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Please reassign partner',
  body = 'A partner stepped back from an accepted visit - assign another trusted crew when you can; we will keep the customer informed.',
  updated_at = now()
where event_type = 'admin_booking_needs_reassignment' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Technician updated',
  body = 'A partner reassigned the technician on a visit - the slot stays unless ops reschedules.',
  updated_at = now()
where event_type = 'admin_booking_technician_reassigned' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit underway',
  body = 'A field visit has started - panel care and safety checks are in progress on site.',
  updated_at = now()
where event_type = 'admin_booking_visit_started' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit complete',
  body = 'A field visit was marked complete - review the job report when convenient.',
  updated_at = now()
where event_type = 'admin_booking_visit_completed' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit cancelled',
  body = 'A booking was cancelled - a fresh assignment restores continuity for the homeowner.',
  updated_at = now()
where event_type = 'admin_booking_cancelled' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'New OorjaMan visit for you',
  body = 'Operations assigned a paid booking to your organisation - please accept and assign a technician; the homeowner is counting on you.',
  updated_at = now()
where event_type = 'vendor_booking_assigned' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Your crew is on site',
  body = 'Your technician started the visit - thank you for representing OorjaMan with care.',
  updated_at = now()
where event_type = 'vendor_booking_visit_started' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit closed',
  body = 'Your technician completed the visit - the report is saved. Thank you for keeping their system healthy.',
  updated_at = now()
where event_type = 'vendor_booking_visit_completed' and channel = 'in_app' and template_key = 'default';

-- ----- 20260733180000_vendor_settlements.sql -----
do $enum$
begin
  create type public.vendor_settlement_kind as enum ('visit_payout', 'cancellation_penalty');

exception
  when duplicate_object then null;

end $enum$;

do $enum$
begin
  create type public.vendor_settlement_status as enum (
    'pending_review',
    'approved',
    'settled',
    'waived'
  );

exception
  when duplicate_object then null;

end $enum$;

create table if not exists public.vendor_settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  kind public.vendor_settlement_kind not null,
  status public.vendor_settlement_status not null default 'pending_review',
  currency text not null default 'INR',
  reference_code text,
  visit_gross_paise bigint,
  platform_fee_paise bigint,
  net_payout_paise bigint,
  penalty_assessed_paise bigint,
  penalty_final_paise bigint,
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  settled_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  settled_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_settlements_visit_payout_amounts check (
    kind <> 'visit_payout'
    or (
      visit_gross_paise is not null
      and platform_fee_paise is not null
      and net_payout_paise is not null
      and net_payout_paise >= 0
    )
  ),
  constraint vendor_settlements_penalty_amounts check (
    kind <> 'cancellation_penalty'
    or penalty_final_paise is not null
  )
);

create unique index if not exists vendor_settlements_booking_kind_uidx
  on public.vendor_settlements (booking_id, kind);

create index if not exists vendor_settlements_vendor_created_idx
  on public.vendor_settlements (vendor_id, created_at desc);

create index if not exists vendor_settlements_status_idx
  on public.vendor_settlements (status, created_at desc);

drop trigger if exists vendor_settlements_set_updated_at on public.vendor_settlements;

create trigger vendor_settlements_set_updated_at
before update on public.vendor_settlements
for each row execute function public.set_updated_at();

comment on table public.vendor_settlements is
  'OorjaMan ↔ partner money movements: visit payouts after completion; penalties after vendor-initiated cancellation of accepted visits.';

-- ----- 20260733190000_platform_vendor_fee_percent.sql -----
alter table public.platform_settings
  add column if not exists vendor_platform_fee_percent numeric(5, 2) not null default 10
  check (
    vendor_platform_fee_percent >= 0
    and vendor_platform_fee_percent <= 100
  );

comment on column public.platform_settings.vendor_platform_fee_percent is
  'OorjaMan commission on completed visit gross (INR paise). Applied when creating visit_payout settlement rows.';

-- ----- 20260733200000_pricing_tiers_catalog_audit.sql -----
alter table public.pricing_catalog_audit
  drop constraint if exists pricing_catalog_audit_table_name_check;

alter table public.pricing_catalog_audit
  add constraint pricing_catalog_audit_table_name_check
  check (table_name in ('pricing_one_time_rates', 'pricing_amc_plans', 'pricing_tiers'));

drop trigger if exists pricing_tiers_audit_trg on public.pricing_tiers;

create trigger pricing_tiers_audit_trg
after insert or update or delete on public.pricing_tiers
for each row execute function public.pricing_catalog_log_audit();

-- ----- 20260733210000_platform_settings_catalog_audit.sql -----
alter table public.pricing_catalog_audit
  drop constraint if exists pricing_catalog_audit_table_name_check;

alter table public.pricing_catalog_audit
  add constraint pricing_catalog_audit_table_name_check
  check (
    table_name in (
      'pricing_one_time_rates',
      'pricing_amc_plans',
      'pricing_tiers',
      'platform_settings'
    )
  );

create or replace function public.platform_settings_log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid := '00000000-0000-4000-8000-000000000001';

v_snapshot jsonb;

begin
  if tg_op = 'INSERT' then
    v_snapshot := jsonb_build_object(
      'customer_late_cancel_fee_paise', new.customer_late_cancel_fee_paise,
      'vendor_platform_fee_percent', new.vendor_platform_fee_percent
    );

insert into public.pricing_catalog_audit (
      table_name, record_id, country_code, operation, old_snapshot, new_snapshot, changed_by
    )
    values ('platform_settings', v_record_id, 'IN', 'insert', null, v_snapshot, auth.uid());

return new;

elsif tg_op = 'DELETE' then
    v_snapshot := jsonb_build_object(
      'customer_late_cancel_fee_paise', old.customer_late_cancel_fee_paise,
      'vendor_platform_fee_percent', old.vendor_platform_fee_percent
    );

insert into public.pricing_catalog_audit (
      table_name, record_id, country_code, operation, old_snapshot, new_snapshot, changed_by
    )
    values ('platform_settings', v_record_id, 'IN', 'delete', v_snapshot, null, auth.uid());

return old;

elsif tg_op = 'UPDATE' then
    v_snapshot := jsonb_build_object(
      'customer_late_cancel_fee_paise', new.customer_late_cancel_fee_paise,
      'vendor_platform_fee_percent', new.vendor_platform_fee_percent
    );

insert into public.pricing_catalog_audit (
      table_name, record_id, country_code, operation, old_snapshot, new_snapshot, changed_by
    )
    values (
      'platform_settings',
      v_record_id,
      'IN',
      'update',
      jsonb_build_object(
        'customer_late_cancel_fee_paise', old.customer_late_cancel_fee_paise,
        'vendor_platform_fee_percent', old.vendor_platform_fee_percent
      ),
      v_snapshot,
      auth.uid()
    );

return new;

end if;

return null;

end;

$$;

drop trigger if exists platform_settings_audit_trg on public.platform_settings;

create trigger platform_settings_audit_trg
after insert or update or delete on public.platform_settings
for each row execute function public.platform_settings_log_audit();

-- ----- 20260733220000_ops_vendor_response_window.sql -----
drop view if exists public.ops_booking_exceptions;

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
  (
    coalesce(
      nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
      nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
      b.created_at
    )
  ) as vendor_response_anchor_at,
  case
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
      then 'awaiting_admin_float'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'default_vendor_unclaimed'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      and (b.metadata #>> '{vendor_routing,reason}') = 'preferred_ok'
      then 'preferred_vendor_no_response'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
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
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      and (b.metadata #>> '{vendor_routing,reason}') = 'preferred_ok'
      then 'high'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
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
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
      then 'Any-partner booking waiting for ops to float marketplace'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
      then 'Default-vendor window expired without claim'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      and (b.metadata #>> '{vendor_routing,reason}') = 'preferred_ok'
      then 'Preferred partner did not accept or assign within 1 hour'
    when b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
      then 'Partner has not accepted or assigned technician within 1 hour'
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
      and (b.metadata #>> '{marketplace,awaiting_admin_float}') = 'true'
      and now() > (b.created_at + interval '2 hours')
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is null
      and (b.metadata #>> '{marketplace,open_until}') is not null
      and now() > ((b.metadata #>> '{marketplace,open_until}')::timestamptz)
    )
    or (
      b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
      and now() > (
        coalesce(
          nullif(trim(b.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
          nullif(trim(b.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
          b.created_at
        ) + interval '1 hour'
      )
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

comment on view public.ops_booking_exceptions is
  'Operational exception queue: marketplace float, partner response window, visit timing.';

grant select on public.ops_booking_exceptions to authenticated;

insert into public.notification_templates (event_type, channel, template_key, subject, body)
values
  (
    'admin_booking_created',
    'in_app',
    'default',
    'New booking',
    'A booking was confirmed and is visible in admin Bookings.'
  ),
  (
    'admin_booking_vendor_response_overdue',
    'in_app',
    'default',
    'Partner response overdue',
    'Assigned partner missed the 1-hour accept/assign window.'
  )
on conflict (event_type, channel, template_key) do update
set
  subject = excluded.subject,
  body = excluded.body;

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('admin_booking_created', 'in_app', true, true),
  ('admin_booking_vendor_response_overdue', 'in_app', true, true)
on conflict (event_type, channel) do nothing;

-- ----- 20260733230000_vendor_response_overdue_cron.sql -----
create or replace function public.notify_overdue_vendor_responses_batch(p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;

v_deadline timestamptz;

v_now timestamptz := now();

v_notified int := 0;

v_scanned int := 0;

v_vendor_name text;

v_ref text;

v_title text;

v_body text;

v_payload jsonb;

v_limit int;

begin
  v_limit := greatest(1, least(coalesce(p_limit, 200), 500));

for rec in
    select b.*
    from public.bookings b
    where b.status = 'confirmed'::public.booking_status
      and b.vendor_id is not null
      and b.technician_id is null
    order by b.scheduled_start asc
    limit v_limit
  loop
    v_scanned := v_scanned + 1;

if nullif(trim(rec.metadata #>> '{ops,vendor_response_overdue_at}'), '') is not null then
      continue;

end if;

if (rec.metadata #>> '{marketplace,awaiting_admin_float}') = 'true' then
      continue;

end if;

v_deadline :=
      coalesce(
        nullif(trim(rec.metadata #>> '{vendor_response,anchor_at}'), '')::timestamptz,
        nullif(trim(rec.metadata #>> '{marketplace,open_at}'), '')::timestamptz,
        rec.created_at
      ) + interval '1 hour';

if v_now <= v_deadline then
      continue;

end if;

select v.business_name
    into v_vendor_name
    from public.vendors v
    where v.id = rec.vendor_id;

v_ref := coalesce(nullif(trim(rec.reference_code), ''), upper(left(rec.id::text, 8)));

v_title := 'Partner response overdue';

v_body :=
      coalesce(nullif(trim(v_vendor_name), ''), 'Assigned partner')
      || ' has not accepted or assigned a technician for '
      || v_ref
      || ' within the 1-hour window. Reassign, float to marketplace, or contact the partner from Operations.';

v_payload := jsonb_build_object(
      'reference_code', rec.reference_code,
      'booking_id', rec.id,
      'title', v_title,
      'body', v_body,
      'href', '/dashboard/bookings?highlight=' || rec.id::text,
      'vendor_id', rec.vendor_id,
      'vendor_name', v_vendor_name,
      'technician_id', null,
      'technician_name', null,
      'status', rec.status::text,
      'emitted_at', to_jsonb(v_now),
      'note', 'Partner response window expired (scheduled scan).'
    );

insert into public.notification_events (
      booking_id,
      recipient_audience,
      recipient_vendor_id,
      event_type,
      channels,
      status,
      processed_at,
      payload
    )
    values (
      rec.id,
      'admin',
      null,
      'admin_booking_vendor_response_overdue',
      jsonb_build_array('in_app'),
      'sent',
      v_now,
      v_payload
    );

update public.bookings
    set metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{ops}',
      coalesce(metadata -> 'ops', '{}'::jsonb)
        || jsonb_build_object('vendor_response_overdue_at', to_jsonb(v_now::text)),
      true
    )
    where id = rec.id;

v_notified := v_notified + 1;

end loop;

return jsonb_build_object('scanned', v_scanned, 'notified', v_notified, 'ran_at', v_now);

end;

$$;

comment on function public.notify_overdue_vendor_responses_batch(int) is
  'Inserts admin in-app notification_events for partners who missed the 1h response window. Idempotent per booking.';

revoke all on function public.notify_overdue_vendor_responses_batch(int) from public;

grant execute on function public.notify_overdue_vendor_responses_batch(int) to service_role;

create extension if not exists pg_cron with schema pg_catalog;

do $cron$
declare
  job_id bigint;

begin
  for job_id in
    select jobid from cron.job where jobname = 'notify-overdue-vendor-responses'
  loop
    perform cron.unschedule(job_id);

end loop;

perform cron.schedule(
    'notify-overdue-vendor-responses',
    '*/5 * * * *',
    $cmd$select public.notify_overdue_vendor_responses_batch(200);$cmd$
  );

exception
  when others then
    raise notice 'pg_cron schedule skipped (enable pg_cron on hosted project or use Dashboard cron → scan-vendor-response-overdue edge function): %', sqlerrm;

end;

$cron$;

-- ----- 20260733250000_vendor_settlements_realtime.sql -----
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vendor_settlements'
  ) then
    alter publication supabase_realtime add table public.vendor_settlements;

end if;

end $$;

-- ----- 20260734000000_recognized_revenue_stats.sql -----
drop view if exists public.recognized_revenue_stats;

create view public.recognized_revenue_stats
with (security_invoker = true) as
with platform_fee as (
  select coalesce(
    (select ps.vendor_platform_fee_percent from public.platform_settings ps where ps.id = 1),
    10::numeric
  ) as fee_percent
),
commission_daily as (
  select
    ((coalesce(p.paid_at, p.created_at) at time zone 'Asia/Kolkata')::date) as day,
    sum(round(p.amount::numeric * pf.fee_percent / 100.0))::bigint as revenue_cents
  from public.payments p
  inner join public.bookings b on b.id = p.booking_id
  cross join platform_fee pf
  where p.status = 'success'::public.payment_status
    and b.status = 'completed'::public.booking_status
  group by 1
),
customer_cancel_fee_daily as (
  select
    ((b.cancelled_at at time zone 'Asia/Kolkata')::date) as day,
    sum(
      greatest(
        0,
        coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
      )
    )::bigint as revenue_cents
  from public.bookings b
  where b.status = 'cancelled'::public.booking_status
    and b.cancelled_at is not null
    and coalesce((b.metadata -> 'customer_cancellation' ->> 'within_grace_window')::boolean, true) = false
    and greatest(
      0,
      coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
    ) > 0
  group by 1
),
vendor_penalty_daily as (
  select
    ((vs.created_at at time zone 'Asia/Kolkata')::date) as day,
    sum(
      greatest(
        0,
        coalesce(vs.penalty_final_paise, vs.penalty_assessed_paise, 0)
      )
    )::bigint as revenue_cents
  from public.vendor_settlements vs
  where vs.kind = 'cancellation_penalty'
  group by 1
),
combined as (
  select day, revenue_cents from commission_daily
  union all
  select day, revenue_cents from customer_cancel_fee_daily
  union all
  select day, revenue_cents from vendor_penalty_daily
),
by_day as (
  select day, sum(revenue_cents)::bigint as revenue_cents
  from combined
  group by 1
)
select
  coalesce((select sum(revenue_cents) from by_day), 0::bigint) as total_revenue_cents,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('day', d.day, 'revenue_cents', d.revenue_cents)
        order by d.day
      )
      from by_day d
    ),
    '[]'::jsonb
  ) as revenue_per_day;

comment on view public.recognized_revenue_stats is
  'Platform revenue: vendor_platform_fee_percent of successful payments on completed visits, plus customer late-cancel and vendor penalty fees.';

grant select on public.recognized_revenue_stats to authenticated;

-- ----- 20260734100000_recognized_revenue_platform_fee.sql -----
drop view if exists public.recognized_revenue_stats;

create view public.recognized_revenue_stats
with (security_invoker = true) as
with platform_fee as (
  select coalesce(
    (select ps.vendor_platform_fee_percent from public.platform_settings ps where ps.id = 1),
    10::numeric
  ) as fee_percent
),
commission_daily as (
  select
    ((coalesce(p.paid_at, p.created_at) at time zone 'Asia/Kolkata')::date) as day,
    sum(round(p.amount::numeric * pf.fee_percent / 100.0))::bigint as revenue_cents
  from public.payments p
  inner join public.bookings b on b.id = p.booking_id
  cross join platform_fee pf
  where p.status = 'success'::public.payment_status
    and b.status = 'completed'::public.booking_status
  group by 1
),
customer_cancel_fee_daily as (
  select
    ((b.cancelled_at at time zone 'Asia/Kolkata')::date) as day,
    sum(
      greatest(
        0,
        coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
      )
    )::bigint as revenue_cents
  from public.bookings b
  where b.status = 'cancelled'::public.booking_status
    and b.cancelled_at is not null
    and coalesce((b.metadata -> 'customer_cancellation' ->> 'within_grace_window')::boolean, true) = false
    and greatest(
      0,
      coalesce((b.metadata -> 'customer_cancellation' ->> 'late_fee_paise')::bigint, 0)
    ) > 0
  group by 1
),
vendor_penalty_daily as (
  select
    ((vs.created_at at time zone 'Asia/Kolkata')::date) as day,
    sum(
      greatest(
        0,
        coalesce(vs.penalty_final_paise, vs.penalty_assessed_paise, 0)
      )
    )::bigint as revenue_cents
  from public.vendor_settlements vs
  where vs.kind = 'cancellation_penalty'
  group by 1
),
combined as (
  select day, revenue_cents from commission_daily
  union all
  select day, revenue_cents from customer_cancel_fee_daily
  union all
  select day, revenue_cents from vendor_penalty_daily
),
by_day as (
  select day, sum(revenue_cents)::bigint as revenue_cents
  from combined
  group by 1
)
select
  coalesce((select sum(revenue_cents) from by_day), 0::bigint) as total_revenue_cents,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('day', d.day, 'revenue_cents', d.revenue_cents)
        order by d.day
      )
      from by_day d
    ),
    '[]'::jsonb
  ) as revenue_per_day;

comment on view public.recognized_revenue_stats is
  'Platform revenue: vendor_platform_fee_percent of successful payments on completed visits, plus cancellation fees.';

grant select on public.recognized_revenue_stats to authenticated;

$$;

$$;

$$;

$$;

$$;

-- End of schema (generated)
