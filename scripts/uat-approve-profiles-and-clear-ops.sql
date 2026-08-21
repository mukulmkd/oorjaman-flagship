-- =============================================================================
-- UAT ONLY — approve all vendors/technicians + wipe booking/payment/notification
-- operational data. Profile rows stay (users, customers, vendors, technicians,
-- addresses on customers, invites, slot availability, push device tokens,
-- pricing/config, support agents/macros).
--
-- Run in Supabase Dashboard → SQL Editor on the **UAT** project (service/postgres).
-- Do NOT run on production.
--
-- Job photos in Storage are not deleted by this script (DB refs only).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Preflight counts (optional visibility)
-- ---------------------------------------------------------------------------
do $$
declare
  v_vendors bigint;
  v_techs bigint;
  v_bookings bigint;
begin
  select count(*) into v_vendors from public.vendors;
  select count(*) into v_techs from public.technicians;
  select count(*) into v_bookings from public.bookings;
  raise notice 'Preflight: vendors=%, technicians=%, bookings=%', v_vendors, v_techs, v_bookings;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Approve all vendors
--    Guards normally require is_admin(); disable trigger for this UAT reset.
-- ---------------------------------------------------------------------------
alter table public.vendors disable trigger vendors_guard_approval_writes;

update public.vendors
set
  approval_status = 'approved'::public.vendor_approval_status,
  reviewed_at = coalesce(reviewed_at, now()),
  approved_at = coalesce(approved_at, now()),
  rejection_reason = null,
  updated_at = now()
where approval_status is distinct from 'approved'::public.vendor_approval_status
   or approved_at is null;

alter table public.vendors enable trigger vendors_guard_approval_writes;

-- ---------------------------------------------------------------------------
-- 2) Approve all technicians (vendor review + platform verification)
-- ---------------------------------------------------------------------------
alter table public.technicians disable trigger technicians_guard_vendor_review_writes;
alter table public.technicians disable trigger technicians_guard_verification_writes;
alter table public.technicians disable trigger technicians_finalize_vendor_approval;

update public.technicians t
set
  vendor_review_status = 'approved',
  vendor_reviewed_at = coalesce(t.vendor_reviewed_at, now()),
  vendor_rejection_reason = null,
  verification_status = 'verified'::public.technician_verification_status,
  is_verified = true,
  verification_reviewed_at = coalesce(t.verification_reviewed_at, now()),
  verification_rejection_reason = null,
  employee_code = coalesce(
    nullif(trim(t.employee_code), ''),
    public.generate_technician_employee_code()
  ),
  updated_at = now()
where t.vendor_review_status is distinct from 'approved'
   or t.verification_status is distinct from 'verified'::public.technician_verification_status
   or coalesce(t.is_verified, false) = false;

alter table public.technicians enable trigger technicians_finalize_vendor_approval;
alter table public.technicians enable trigger technicians_guard_verification_writes;
alter table public.technicians enable trigger technicians_guard_vendor_review_writes;

-- ---------------------------------------------------------------------------
-- 3) Clear booking / payment / AMC / settlement / notification / activity data
--    Listed together so FKs between these tables do not block truncate.
-- ---------------------------------------------------------------------------
truncate table
  public.amc_wallet_entries,
  public.amc_wallets,
  public.vendor_deferred_penalties,
  public.vendor_settlements,
  public.customer_oorjaman_credit_redemptions,
  public.customer_oorjaman_credit_grants,
  public.payment_attempts,
  public.payment_refunds,
  public.payments,
  public.razorpay_webhook_events,
  public.job_reports,
  public.subscription_visit_slots,
  public.customer_site_activity_events,
  public.technician_activity_events,
  public.notification_events,
  public.customer_push_outbox,
  public.technician_push_outbox,
  public.support_message_attachments,
  public.support_messages,
  public.support_conversation_events,
  public.support_conversations,
  public.technician_locations,
  public.bookings,
  public.subscriptions,
  public.edge_rate_limit_buckets
restart identity cascade;

commit;

-- ---------------------------------------------------------------------------
-- 4) Post-check (run after commit)
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.vendors where approval_status = 'approved') as vendors_approved,
  (select count(*) from public.vendors) as vendors_total,
  (select count(*) from public.technicians where verification_status = 'verified' and vendor_review_status = 'approved') as techs_approved,
  (select count(*) from public.technicians) as techs_total,
  (select count(*) from public.bookings) as bookings_left,
  (select count(*) from public.payments) as payments_left,
  (select count(*) from public.subscriptions) as subscriptions_left,
  (select count(*) from public.notification_events) as notification_events_left,
  (select count(*) from public.customers) as customers_kept,
  (select count(*) from public.users) as users_kept;
