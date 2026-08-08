-- Security hardening (SECURITY_REVIEW H2): make `job-photos` a PRIVATE bucket.
--
-- Before: bucket was public with a read policy allowing ANY select on the bucket, so
-- customer site/property photos (and technician start selfies) were viewable by anyone
-- with — or guessing — the object URL, with no authentication.
--
-- After: bucket is private; reads require a short-lived signed URL and RLS scoped to the
-- people involved in the booking (admin, the assigned technician, the booking's customer,
-- and the booking's vendor). Uploads keep the existing assigned-technician/admin policy
-- from 20260744200000_job_photos_storage_bucket.sql.

update storage.buckets set public = false where id = 'job-photos';

drop policy if exists job_photos_public_read on storage.objects;
drop policy if exists job_photos_scoped_read on storage.objects;

-- Object paths are `{booking_id}/{phase}-….ext`; scope reads by that booking.
create policy job_photos_scoped_read
on storage.objects for select to authenticated
using (
  bucket_id = 'job-photos'
  and (storage.foldername(name))[1] is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and (
          (b.technician_id is not null and b.technician_id = public.my_technician_id())
          or b.customer_id = public.my_customer_id()
          or (b.vendor_id is not null and b.vendor_id = public.my_vendor_id())
        )
    )
  )
);
