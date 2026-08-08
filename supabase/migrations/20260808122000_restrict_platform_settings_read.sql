-- SECURITY_REVIEW M2: platform_settings (singleton id=1) was readable in full by every
-- authenticated user, leaking the platform margin (vendor_platform_fee_percent) and the
-- default-vendor id to customers/vendors. Non-admin clients only need three booking-routing
-- fields, so expose those via a SECURITY DEFINER RPC and restrict direct table reads to admins.
--
-- Safe to run before/with the app deploy that switches reads to the RPC: this is pre-launch,
-- so there are no already-released clients still doing a direct SELECT on the table.

create or replace function public.get_booking_routing_defaults()
returns table (
  default_vendor_id uuid,
  customer_late_cancel_fee_paise integer,
  vendor_platform_fee_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ps.default_vendor_id,
    ps.customer_late_cancel_fee_paise,
    ps.vendor_platform_fee_percent
  from public.platform_settings ps
  where ps.id = 1;
$$;

revoke all on function public.get_booking_routing_defaults() from public;
grant execute on function public.get_booking_routing_defaults() to authenticated;

-- Direct table reads: admins only (the RPC above covers all non-admin needs).
drop policy if exists platform_settings_select_authenticated on public.platform_settings;
drop policy if exists platform_settings_select_admin on public.platform_settings;

create policy platform_settings_select_admin
on public.platform_settings for select to authenticated
using (public.is_admin());
