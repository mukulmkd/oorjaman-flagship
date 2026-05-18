-- Allow vendors to read bookings they released via "cancel accepted → ops reassignment",
-- so dashboards, penalty aggregates, and 30‑day strike counts stay consistent.

drop policy if exists bookings_select_vendor on public.bookings;

create policy bookings_select_vendor
on public.bookings for select to authenticated
using (
  public.is_approved_vendor_user()
  and (
    (vendor_id is not null and vendor_id = public.my_vendor_id())
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","floated":true}}'::jsonb
    )
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","vendor_cancelled_reassign":true}}'::jsonb
      and coalesce(metadata->'vendor_reassignment'->>'previous_vendor_id', '') = public.my_vendor_id()::text
    )
  )
);
