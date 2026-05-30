-- Allow assigned technicians to create visit_payout rows when completing a job (client-side finalize).

drop policy if exists vendor_settlements_insert on public.vendor_settlements;

create policy vendor_settlements_insert
on public.vendor_settlements for insert to authenticated
with check (
  public.is_admin()
  or (
    vendor_id = public.my_vendor_id()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.vendor_id = vendor_settlements.vendor_id
    )
  )
  or exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.vendor_id is not null
      and b.vendor_id = vendor_settlements.vendor_id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
  )
);
