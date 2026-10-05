-- A state desk can schedule the next visit on a paid AMC whose site is in their state.
-- National admins already insert bookings and update visit slots.

drop policy if exists bookings_insert_state_ops_amc on public.bookings;
create policy bookings_insert_state_ops_amc
on public.bookings for insert to authenticated
with check (
  public.is_state_ops()
  and subscription_id is not null
  and public.state_in_my_operation(service_site_address ->> 'state')
);

drop policy if exists subscription_visit_slots_update_state_ops on public.subscription_visit_slots;
create policy subscription_visit_slots_update_state_ops
on public.subscription_visit_slots for update to authenticated
using (public.state_in_my_operation(public.subscription_site_state(subscription_id)))
with check (public.state_in_my_operation(public.subscription_site_state(subscription_id)));

drop policy if exists subscriptions_update_state_ops on public.subscriptions;
create policy subscriptions_update_state_ops
on public.subscriptions for update to authenticated
using (
  public.is_state_ops()
  and public.state_in_my_operation(metadata -> 'service_site_address' ->> 'state')
)
with check (
  public.is_state_ops()
  and public.state_in_my_operation(metadata -> 'service_site_address' ->> 'state')
);

drop policy if exists notification_events_insert_state_ops on public.notification_events;
create policy notification_events_insert_state_ops
on public.notification_events for insert to authenticated
with check (
  public.is_state_ops()
  and booking_id is not null
  and exists (
    select 1
    from public.bookings b
    where b.id = notification_events.booking_id
      and public.state_in_my_operation(b.service_site_address ->> 'state')
  )
);
