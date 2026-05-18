-- Customer site photo gallery (private Storage + JSON pointers on metadata.service_addresses[]).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-site-photos',
  'customer-site-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {customer_user_id}/{service_address_id}/{photo_id}.ext

create or replace function public.customer_site_photo_can_read(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or split_part(object_path, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.bookings b
      join public.customers c on c.id = b.customer_id
      where c.user_id::text = split_part(object_path, '/', 1)
        and coalesce(nullif(trim(b.metadata->>'service_address_id'), ''), '') = split_part(object_path, '/', 2)
        and b.technician_id is not null
        and b.status in (
          'accepted'::public.booking_status,
          'in_progress'::public.booking_status,
          'completed'::public.booking_status
        )
        and (
          b.technician_id = public.my_technician_id()
          or (b.vendor_id is not null and b.vendor_id = public.my_vendor_id())
        )
    );
$$;

create or replace function public.customer_site_photo_can_write(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select split_part(object_path, '/', 1) = auth.uid()::text
    and exists (
      select 1
      from public.customers c
      where c.user_id = auth.uid()
        and exists (
          select 1
          from jsonb_array_elements(coalesce(c.metadata->'service_addresses', '[]'::jsonb)) elem
          where elem->>'id' = split_part(object_path, '/', 2)
        )
    );
$$;

grant execute on function public.customer_site_photo_can_read(text) to authenticated;
grant execute on function public.customer_site_photo_can_write(text) to authenticated;

drop policy if exists customer_site_photos_select on storage.objects;
drop policy if exists customer_site_photos_insert on storage.objects;
drop policy if exists customer_site_photos_update on storage.objects;
drop policy if exists customer_site_photos_delete on storage.objects;

create policy customer_site_photos_select
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_read(name)
);

create policy customer_site_photos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
);

create policy customer_site_photos_update
on storage.objects for update to authenticated
using (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
)
with check (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
);

create policy customer_site_photos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
);

-- Technicians: read customer metadata when assigned to a booking (site photo gallery).
drop policy if exists customers_select_scope on public.customers;

create policy customers_select_scope
on public.customers for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.bookings b
      where b.customer_id = customers.id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
  or exists (
    select 1
    from public.bookings b
    where b.customer_id = customers.id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
      and b.status in (
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status
      )
  )
);

comment on function public.customer_site_photo_can_read(text) is
  'Storage RLS: customer owns path; vendor/technician when booking accepted+ with technician assigned.';
