-- =============================================================================
-- AMC subscriptions → auto-generated booking visits
-- =============================================================================
-- Legacy: visit generation used to run here via trigger. Scheduling and vendor
-- Visit scheduling now lives in the app (`packages/api` → `scheduleAmcVisitSlot`).
-- First AMC visit is created without `vendor_id` (`metadata.marketplace.awaiting_admin_float`);
-- ops floats it to partners like other default-vendor rows. Later AMC visits resolve a single partner via `resolveBookingVendor`.
--
-- Product: AMC is forward-only - existing one-time paid bookings are never linked to
-- `subscription_id`; they complete on their original pricing. AMC adds separate rows.
--
-- Apply after `schema.sql` + `policies.sql` so duplicate triggers are removed on redeploy.
-- =============================================================================

drop trigger if exists subscriptions_generate_bookings on public.subscriptions;

drop function if exists public.generate_bookings_for_subscription();
