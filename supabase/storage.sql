-- =============================================================================
-- Supabase Storage - job evidence photos (`job-photos` bucket)
-- =============================================================================
-- Canonical definition: supabase/migrations/20260744200000_job_photos_storage_bucket.sql
-- + 20260808120500_job_photos_private_bucket.sql (PRIVATE bucket, SECURITY_REVIEW H2).
-- (applied via npm run db:push). This file is a reference copy for manual SQL editor use.
-- =============================================================================

-- PRIVATE bucket: reads require short-lived signed URLs (no getPublicUrl).
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "job_photos_public_read" on storage.objects;
drop policy if exists "job_photos_scoped_read" on storage.objects;
drop policy if exists "job_photos_technician_insert" on storage.objects;

-- Read is scoped to the people involved in the booking (folder = booking id).
create policy "job_photos_scoped_read"
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

-- Technicians assigned to the booking (or admins) may upload into `{booking_id}/…`.
create policy "job_photos_technician_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and exists (
        select 1
        from public.bookings b
        where b.id::text = (storage.foldername(name))[1]
          and b.technician_id is not null
          and b.technician_id = public.my_technician_id()
      )
    )
  )
);
