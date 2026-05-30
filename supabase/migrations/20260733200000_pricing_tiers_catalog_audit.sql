-- Include geo-tier add-ons (pricing_tiers) in catalogue audit.

alter table public.pricing_catalog_audit
  drop constraint if exists pricing_catalog_audit_table_name_check;

alter table public.pricing_catalog_audit
  add constraint pricing_catalog_audit_table_name_check
  check (table_name in ('pricing_one_time_rates', 'pricing_amc_plans', 'pricing_tiers'));

drop trigger if exists pricing_tiers_audit_trg on public.pricing_tiers;
create trigger pricing_tiers_audit_trg
after insert or update or delete on public.pricing_tiers
for each row execute function public.pricing_catalog_log_audit();
