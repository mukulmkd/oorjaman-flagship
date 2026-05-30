-- =============================================================================
-- RLS core helpers + baseline ENABLE RLS (prepended by npm run db:reference)
-- Also applied via migration 20260735000000_rls_core_helper_functions.sql
-- =============================================================================

-- =============================================================================
-- Row Level Security - OorjaManDB (apply AFTER schema.sql)
-- =============================================================================
-- Idempotent (safe to re-run): policies are DROP POLICY IF EXISTS then CREATE;
-- helper functions use CREATE OR REPLACE; GRANT is repeatable; enabling RLS on a
-- table that already has RLS enabled is a no-op; storage buckets use INSERT ...
-- ON CONFLICT DO UPDATE.
-- Rules:
-- - Customers: own profile/subscriptions/bookings only (via customer extension row).
-- - Approved vendors: own vendor row + bookings for their vendor_id (+ linked technicians/customers
--   per policy). Pending / non-approved vendor accounts cannot use operational dashboard data (no
--   bookings or team list via vendor scope).
-- - Technicians: own technician row + bookings jobs assigned to them.
-- - Admin (users.role = 'admin'): full access to all tables below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER reads bypass RLS on public.users safely by PK)
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'::public.user_role
  );
$$;

create or replace function public.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.my_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id
  from public.vendors v
  where v.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.my_technician_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.technicians t
  where t.user_id = auth.uid()
  limit 1;
$$;

-- True when the current user owns a vendors row with approval_status = approved (operational vendor).
create or replace function public.is_approved_vendor_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select v.approval_status = 'approved'::public.vendor_approval_status
      from public.vendors v
      where v.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_customer_id() to authenticated;
grant execute on function public.my_vendor_id() to authenticated;
grant execute on function public.my_technician_id() to authenticated;
grant execute on function public.is_approved_vendor_user() to authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.technicians enable row level security;
alter table public.subscriptions enable row level security;
alter table public.bookings enable row level security;
alter table public.job_reports enable row level security;
alter table public.platform_settings enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.pricing_tiers enable row level security;
alter table public.pricing_city_tiers enable row level security;
alter table public.payments enable row level security;
alter table public.technician_locations enable row level security;
alter table public.vendor_technician_invites enable row level security;
alter table public.vendor_slot_availability enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_channel_settings enable row level security;

-- -----------------------------------------------------------------------------
-- Drop existing policies (idempotent apply)
-- -----------------------------------------------------------------------------

drop policy if exists users_select_self_or_admin on public.users;
drop policy if exists users_update_self_or_admin on public.users;
drop policy if exists users_insert_admin on public.users;

