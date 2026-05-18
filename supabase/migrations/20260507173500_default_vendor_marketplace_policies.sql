-- Allow approved vendors to see default-vendor marketplace bookings
-- and claim them during the confirmed stage.

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
  )
);

drop policy if exists bookings_update_vendor on public.bookings;
create policy bookings_update_vendor
on public.bookings for update to authenticated
using (
  public.is_approved_vendor_user()
  and (
    (vendor_id is not null and vendor_id = public.my_vendor_id())
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","floated":true}}'::jsonb
    )
  )
)
with check (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
);
