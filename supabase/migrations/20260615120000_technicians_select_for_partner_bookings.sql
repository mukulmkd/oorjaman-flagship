-- Partners can read Oorjaman field-crew rows when those technicians are (or were) assigned to the partner's bookings.
-- (Technicians are not "owned" by vendors; assignment is operational.)

drop policy if exists technicians_select_for_partner_bookings on public.technicians;

create policy technicians_select_for_partner_bookings
on public.technicians for select to authenticated
using (
  public.is_approved_vendor_user()
  and public.my_vendor_id() is not null
  and exists (
    select 1
    from public.bookings b
    where b.technician_id = technicians.id
      and b.vendor_id = public.my_vendor_id()
  )
);
