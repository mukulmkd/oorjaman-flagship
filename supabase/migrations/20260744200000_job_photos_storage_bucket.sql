-- Job evidence photos: before/after site shots and start-of-visit selfie (technician app).
-- Path: {booking_id}/{phase}-{timestamp-random}.jpg
-- Was previously only in supabase/storage.sql (manual SQL editor) — not applied by db:push.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_photos_public_read on storage.objects;
drop policy if exists job_photos_technician_insert on storage.objects;

-- Public read: URLs use unguessable paths; bucket is public for getPublicUrl().
create policy job_photos_public_read
on storage.objects for select
using (bucket_id = 'job-photos');

-- Assigned technician (or admin) may upload into `{booking_id}/…`.
create policy job_photos_technician_insert
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
