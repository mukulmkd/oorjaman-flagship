-- Tier catalog + city→tier maps (country-scoped). Extends pricing_rules with country_code + tier_code.

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

alter table public.pricing_tiers enable row level security;

drop policy if exists pricing_tiers_select_authenticated on public.pricing_tiers;
drop policy if exists pricing_tiers_insert_admin on public.pricing_tiers;
drop policy if exists pricing_tiers_update_admin on public.pricing_tiers;
drop policy if exists pricing_tiers_delete_admin on public.pricing_tiers;

create policy pricing_tiers_select_authenticated
on public.pricing_tiers for select to authenticated
using (true);

create policy pricing_tiers_insert_admin
on public.pricing_tiers for insert to authenticated
with check (public.is_admin());

create policy pricing_tiers_update_admin
on public.pricing_tiers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_tiers_delete_admin
on public.pricing_tiers for delete to authenticated
using (public.is_admin());

alter table public.pricing_city_tiers enable row level security;

drop policy if exists pricing_city_tiers_select_authenticated on public.pricing_city_tiers;
drop policy if exists pricing_city_tiers_insert_admin on public.pricing_city_tiers;
drop policy if exists pricing_city_tiers_update_admin on public.pricing_city_tiers;
drop policy if exists pricing_city_tiers_delete_admin on public.pricing_city_tiers;

create policy pricing_city_tiers_select_authenticated
on public.pricing_city_tiers for select to authenticated
using (true);

create policy pricing_city_tiers_insert_admin
on public.pricing_city_tiers for insert to authenticated
with check (public.is_admin());

create policy pricing_city_tiers_update_admin
on public.pricing_city_tiers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_city_tiers_delete_admin
on public.pricing_city_tiers for delete to authenticated
using (public.is_admin());
