-- =============================================================================
-- Reconcile PROD notification read scope -> repo intended state.
-- Repo policies.sql (latest, line ~1293) tightens vendor visibility with an explicit
-- recipient_audience = 'vendor' predicate; PROD is missing it (older version). UAT already
-- has this. Run in the PROD SQL editor. Idempotent (drop+create). Re-run the compare after.
-- =============================================================================

drop policy if exists notification_events_select_scope on public.notification_events;

create policy notification_events_select_scope
on public.notification_events for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and recipient_audience = 'vendor'
    and recipient_vendor_id is not null
    and recipient_vendor_id = public.my_vendor_id()
  )
);
