-- Allow assigned technicians/vendors to read customer site photos when the booking
-- links to the address via metadata OR via an AMC subscription at that address.

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
        and (
          coalesce(nullif(trim(b.metadata->>'service_address_id'), ''), '') = split_part(object_path, '/', 2)
          or (
            b.subscription_id is not null
            and exists (
              select 1
              from public.subscriptions s
              where s.id = b.subscription_id
                and (
                  coalesce(nullif(trim(s.service_address_id), ''), '') = split_part(object_path, '/', 2)
                  or coalesce(nullif(trim(s.metadata->>'service_address_id'), ''), '') = split_part(object_path, '/', 2)
                )
            )
          )
        )
    );
$$;

comment on function public.customer_site_photo_can_read(text) is
  'Storage read for customer-site-photos: owner, admin, or assigned vendor/tech on accepted+ booking matching path address via booking metadata or subscription.';
