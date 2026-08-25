-- Gross-up catalogue prices (~2.36% Razorpay platform fee + GST on fee) so prepaid
-- checkout recovers gateway cost. Rounded up to the next rupee ending in 9.
-- Marketing web catalogue (`apps/oorjaman-web/lib/pricing-catalog.ts`) mirrors these.

insert into public.pricing_one_time_rates (country_code, capacity_tier_code, amount_cents, per_panel_rate_cents)
values
  ('IN', 'kw_3', 61900, 10000),
  ('IN', 'kw_4', 71900, 10000),
  ('IN', 'kw_5', 81900, 10000),
  ('IN', 'kw_6', 92900, 10000),
  ('IN', 'kw_8', 112900, 10000),
  ('IN', 'kw_9', 122900, 10000),
  ('IN', 'kw_10', 133900, 10000)
on conflict (country_code, capacity_tier_code) do update set
  amount_cents = excluded.amount_cents,
  per_panel_rate_cents = excluded.per_panel_rate_cents,
  is_active = true;

insert into public.pricing_amc_plans (
  country_code, capacity_tier_code, plan_code, plan_name, contract_months, visits_included, visits_per_year, amount_cents, billing_period, sort_order, is_active
) values
  ('IN', 'kw_3', 'amc_kw3_y1_3', '3 kW · SP-1', 12, 3, 3, 163900, 'custom', 10, true),
  ('IN', 'kw_3', 'amc_kw3_y2_6', '3 kW · SP-2', 24, 6, null, 327900, 'custom', 30, true),
  ('IN', 'kw_4', 'amc_kw4_y1_3', '4 kW · SP-1', 12, 3, 3, 204900, 'custom', 10, true),
  ('IN', 'kw_4', 'amc_kw4_y2_6', '4 kW · SP-2', 24, 6, null, 389900, 'custom', 30, true),
  ('IN', 'kw_5', 'amc_kw5_y1_3', '5 kW · SP-1', 12, 3, 3, 235900, 'custom', 10, true),
  ('IN', 'kw_5', 'amc_kw5_y2_6', '5 kW · SP-2', 24, 6, null, 440900, 'custom', 30, true),
  ('IN', 'kw_6', 'amc_kw6_y1_3', '6 kW · SP-1', 12, 3, 3, 266900, 'custom', 10, true),
  ('IN', 'kw_6', 'amc_kw6_y2_6', '6 kW · SP-2', 24, 6, null, 512900, 'custom', 30, true),
  ('IN', 'kw_8', 'amc_kw8_y1_3', '8 kW · SP-1', 12, 3, 3, 307900, 'custom', 10, true),
  ('IN', 'kw_8', 'amc_kw8_y2_6', '8 kW · SP-2', 24, 6, null, 614900, 'custom', 30, true),
  ('IN', 'kw_10', 'amc_kw10_y1_3', '10 kW · SP-1', 12, 3, 3, 368900, 'custom', 10, true),
  ('IN', 'kw_10', 'amc_kw10_y2_6', '10 kW · SP-2', 24, 6, null, 778900, 'custom', 30, true)
on conflict (plan_code) do update set
  plan_name = excluded.plan_name,
  contract_months = excluded.contract_months,
  visits_included = excluded.visits_included,
  visits_per_year = excluded.visits_per_year,
  amount_cents = excluded.amount_cents,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
