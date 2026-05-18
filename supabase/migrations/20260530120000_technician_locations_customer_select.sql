-- Customers may read technician_locations for technicians assigned to their bookings (last-known map).

drop policy if exists technician_locations_select_customer_booking on public.technician_locations;

create policy technician_locations_select_customer_booking
on public.technician_locations for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.customer_id = public.my_customer_id()
      and b.technician_id is not null
      and b.technician_id = technician_locations.technician_id
  )
);
