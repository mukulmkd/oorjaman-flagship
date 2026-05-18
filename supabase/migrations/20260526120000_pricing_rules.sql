-- Solar cleaning pricing rules (INR paise). One default row (city IS NULL) + optional per-city overrides.

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

alter table public.pricing_rules enable row level security;

drop policy if exists pricing_rules_select_authenticated on public.pricing_rules;
drop policy if exists pricing_rules_insert_admin on public.pricing_rules;
drop policy if exists pricing_rules_update_admin on public.pricing_rules;
drop policy if exists pricing_rules_delete_admin on public.pricing_rules;

create policy pricing_rules_select_authenticated
on public.pricing_rules for select to authenticated
using (true);

create policy pricing_rules_insert_admin
on public.pricing_rules for insert to authenticated
with check (public.is_admin());

create policy pricing_rules_update_admin
on public.pricing_rules for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_rules_delete_admin
on public.pricing_rules for delete to authenticated
using (public.is_admin());
