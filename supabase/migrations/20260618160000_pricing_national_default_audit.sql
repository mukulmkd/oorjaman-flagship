-- Append-only audit of national default pricing rows (city + tier_code both empty).
-- Logged via SECURITY DEFINER trigger; admins read through RLS.

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

alter table public.pricing_national_default_audit enable row level security;

drop policy if exists pricing_national_default_audit_select_admin on public.pricing_national_default_audit;
create policy pricing_national_default_audit_select_admin
on public.pricing_national_default_audit for select to authenticated
using (public.is_admin());

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
