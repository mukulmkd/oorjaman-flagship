-- Fixed capacity-tier pricing (one-time + AMC) with admin-editable catalog and audit trail.

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

-- Audit triggers
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

alter table public.service_capacity_tiers enable row level security;
alter table public.pricing_one_time_rates enable row level security;
alter table public.pricing_amc_plans enable row level security;
alter table public.pricing_catalog_audit enable row level security;

drop policy if exists service_capacity_tiers_select_authenticated on public.service_capacity_tiers;
create policy service_capacity_tiers_select_authenticated
on public.service_capacity_tiers for select to authenticated using (true);

drop policy if exists service_capacity_tiers_write_admin on public.service_capacity_tiers;
create policy service_capacity_tiers_write_admin
on public.service_capacity_tiers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists pricing_one_time_rates_select_authenticated on public.pricing_one_time_rates;
create policy pricing_one_time_rates_select_authenticated
on public.pricing_one_time_rates for select to authenticated using (true);

drop policy if exists pricing_one_time_rates_write_admin on public.pricing_one_time_rates;
create policy pricing_one_time_rates_write_admin
on public.pricing_one_time_rates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists pricing_amc_plans_select_authenticated on public.pricing_amc_plans;
create policy pricing_amc_plans_select_authenticated
on public.pricing_amc_plans for select to authenticated using (true);

drop policy if exists pricing_amc_plans_write_admin on public.pricing_amc_plans;
create policy pricing_amc_plans_write_admin
on public.pricing_amc_plans for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists pricing_catalog_audit_select_admin on public.pricing_catalog_audit;
create policy pricing_catalog_audit_select_admin
on public.pricing_catalog_audit for select to authenticated using (public.is_admin());

grant select on public.service_capacity_tiers to authenticated;
grant select on public.pricing_one_time_rates to authenticated;
grant select on public.pricing_amc_plans to authenticated;
grant select on public.pricing_catalog_audit to authenticated;

-- Seed capacity tiers (INR one-time + AMC catalog)
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
