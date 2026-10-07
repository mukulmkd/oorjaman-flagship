-- State desks can see partner payouts in their states, but only national admins could
-- update them. Approving from the operations portal then returned no row (HTTP 406).

drop policy if exists vendor_settlements_update_state_ops on public.vendor_settlements;

create policy vendor_settlements_update_state_ops
on public.vendor_settlements for update to authenticated
using (
  public.is_state_ops()
  and exists (
    select 1
    from public.bookings b
    where b.id = vendor_settlements.booking_id
      and public.state_in_my_operation(b.service_site_address->>'state')
  )
)
with check (
  public.is_state_ops()
  and exists (
    select 1
    from public.bookings b
    where b.id = vendor_settlements.booking_id
      and public.state_in_my_operation(b.service_site_address->>'state')
  )
);
