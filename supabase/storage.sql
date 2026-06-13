-- =============================================================================
-- Supabase Storage - job evidence photos (`job-photos` bucket)
-- =============================================================================
-- Canonical definition: supabase/migrations/20260744200000_job_photos_storage_bucket.sql
-- (applied via npm run db:push). This file is a reference copy for manual SQL editor use.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "job_photos_public_read" on storage.objects;
drop policy if exists "job_photos_technician_insert" on storage.objects;

-- Anyone can read objects in this bucket (URLs are unguessable UUID filenames).
create policy "job_photos_public_read"
on storage.objects for select
using (bucket_id = 'job-photos');

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
