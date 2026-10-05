-- Signup uploads use storage upsert (INSERT ... ON CONFLICT DO UPDATE RETURNING *).
-- That statement needs a SELECT policy as well as INSERT and UPDATE.
-- Without it, a valid draft upload fails with
-- "new row violates row-level security policy" even though the insert check passes.
-- The helper only matches an in-progress draft, so submitted files stay admin-only.

drop policy if exists vendor_intake_select_draft on storage.objects;

create policy vendor_intake_select_draft on storage.objects for
select
  to anon,
  authenticated using (
    bucket_id = 'vendor-intake'
    and public.vendor_intake_allows_storage_upload (name)
  );
