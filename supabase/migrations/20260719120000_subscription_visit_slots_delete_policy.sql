-- Reconcile AMC visit slots deletes unbooked placeholders when visit count shrinks.
drop policy if exists subscription_visit_slots_delete_own on public.subscription_visit_slots;
create policy subscription_visit_slots_delete_own
on public.subscription_visit_slots for delete to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
);
