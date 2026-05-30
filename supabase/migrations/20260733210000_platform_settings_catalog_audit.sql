-- Log platform_settings changes (e.g. customer late-cancellation fee) in catalogue audit.

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

-- Singleton row id=1 maps to this stable uuid in the audit ledger.
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
