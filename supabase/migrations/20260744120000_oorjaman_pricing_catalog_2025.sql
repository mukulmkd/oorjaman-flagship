-- OorjaMan published pricing (May 2025 catalogue). GST 18% included in all amounts.

insert into public.service_capacity_tiers (country_code, code, capacity_kw, typical_panel_count, label, sort_order)
values
  ('IN', 'kw_9', 9, 16, '9 kW (16 panels)', 55)
on conflict (country_code, code) do update set
  capacity_kw = excluded.capacity_kw,
  typical_panel_count = excluded.typical_panel_count,
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.pricing_one_time_rates (country_code, capacity_tier_code, amount_cents, per_panel_rate_cents)
values
  ('IN', 'kw_3', 59900, 10000),
  ('IN', 'kw_4', 69900, 10000),
  ('IN', 'kw_5', 79900, 10000),
  ('IN', 'kw_6', 89900, 10000),
  ('IN', 'kw_8', 109900, 10000),
  ('IN', 'kw_9', 119900, 10000),
  ('IN', 'kw_10', 129900, 10000)
on conflict (country_code, capacity_tier_code) do update set
  amount_cents = excluded.amount_cents,
  per_panel_rate_cents = excluded.per_panel_rate_cents,
  is_active = true;

-- Retire 4-visits/year packages (replaced by SP-1 / SP-2 catalogue).
update public.pricing_amc_plans
set is_active = false
where country_code = 'IN' and plan_code like '%_y1_4';

insert into public.pricing_amc_plans (
  country_code, capacity_tier_code, plan_code, plan_name, contract_months, visits_included, visits_per_year, amount_cents, billing_period, sort_order, is_active
) values
  ('IN', 'kw_3', 'amc_kw3_y1_3', '3 kW · SP-1', 12, 3, 3, 159900, 'custom', 10, true),
  ('IN', 'kw_3', 'amc_kw3_y2_6', '3 kW · SP-2', 24, 6, null, 319900, 'custom', 30, true),
  ('IN', 'kw_4', 'amc_kw4_y1_3', '4 kW · SP-1', 12, 3, 3, 199900, 'custom', 10, true),
  ('IN', 'kw_4', 'amc_kw4_y2_6', '4 kW · SP-2', 24, 6, null, 379900, 'custom', 30, true),
  ('IN', 'kw_5', 'amc_kw5_y1_3', '5 kW · SP-1', 12, 3, 3, 229900, 'custom', 10, true),
  ('IN', 'kw_5', 'amc_kw5_y2_6', '5 kW · SP-2', 24, 6, null, 429900, 'custom', 30, true),
  ('IN', 'kw_6', 'amc_kw6_y1_3', '6 kW · SP-1', 12, 3, 3, 259900, 'custom', 10, true),
  ('IN', 'kw_6', 'amc_kw6_y2_6', '6 kW · SP-2', 24, 6, null, 499900, 'custom', 30, true),
  ('IN', 'kw_8', 'amc_kw8_y1_3', '8 kW · SP-1', 12, 3, 3, 299900, 'custom', 10, true),
  ('IN', 'kw_8', 'amc_kw8_y2_6', '8 kW · SP-2', 24, 6, null, 599900, 'custom', 30, true),
  ('IN', 'kw_10', 'amc_kw10_y1_3', '10 kW · SP-1', 12, 3, 3, 359900, 'custom', 10, true),
  ('IN', 'kw_10', 'amc_kw10_y2_6', '10 kW · SP-2', 24, 6, null, 759900, 'custom', 30, true)
on conflict (plan_code) do update set
  plan_name = excluded.plan_name,
  contract_months = excluded.contract_months,
  visits_included = excluded.visits_included,
  visits_per_year = excluded.visits_per_year,
  amount_cents = excluded.amount_cents,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
