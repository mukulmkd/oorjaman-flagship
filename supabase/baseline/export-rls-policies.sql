-- =============================================================================
-- SECURITY_REVIEW H3 — Docker-free RLS baseline export
-- =============================================================================
-- `supabase db dump` needs Docker (it runs pg_dump in a container). If Docker is
-- not available, run THIS query in the Supabase SQL editor (or any SQL client)
-- against the linked project, then export the result (Download CSV / copy) into
-- supabase/baseline/prod_baseline_<date>_policies.sql.
--
-- It regenerates every public-schema policy as an idempotent, apply-ready
-- `CREATE POLICY` statement (preceded by ENABLE RLS + DROP POLICY IF EXISTS), so
-- the output reproduces prod's row-level security on a fresh database.
--
-- NOTE: this captures POLICIES + ENABLE RLS (the security-relevant H3 gap). Full
-- base-table DDL (CREATE TABLE) still needs `pg_dump` (start Docker + npm run db:baseline)
-- for a complete DR baseline; the tables themselves already exist in prod today.
-- =============================================================================

with rls as (
  select format(
    'alter table %I.%I enable row level security;',
    n.nspname, c.relname
  ) as ddl,
  c.relname as tablename,
  0 as sort
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
),
pol as (
  select
    p.tablename,
    1 as sort,
    format(
      E'drop policy if exists %I on %I.%I;\ncreate policy %I on %I.%I as %s for %s to %s%s%s;',
      p.policyname, p.schemaname, p.tablename,
      p.policyname, p.schemaname, p.tablename,
      lower(p.permissive),
      lower(p.cmd),
      array_to_string(p.roles, ', '),
      case when p.qual is not null then E'\n  using (' || p.qual || ')' else '' end,
      case when p.with_check is not null then E'\n  with check (' || p.with_check || ')' else '' end
    ) as ddl
  from pg_policies p
  where p.schemaname = 'public'
)
select ddl
from (
  select ddl, tablename, sort from rls
  union all
  select ddl, tablename, sort from pol
) x
order by tablename, sort, ddl;
