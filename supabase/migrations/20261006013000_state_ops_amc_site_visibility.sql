-- A state desk must see an AMC whose site is in their state even when no visit
-- has been booked yet. The site lives on the subscription, not only on a booking
-- or the customer's default address.

create or replace function public.subscription_site_state(p_subscription_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(s.metadata -> 'service_site_address' ->> 'state'), '')
  from public.subscriptions s
  where s.id = p_subscription_id;
$$;

create or replace function public.customer_has_amc_in_my_operation(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and p_customer_id is not null
    and exists (
      select 1
      from public.subscriptions s
      where s.customer_id = p_customer_id
        and public.state_in_my_operation(s.metadata -> 'service_site_address' ->> 'state')
    );
$$;

revoke all on function public.subscription_site_state(uuid) from public;
revoke all on function public.customer_has_amc_in_my_operation(uuid) from public;
grant execute on function public.subscription_site_state(uuid) to authenticated;
grant execute on function public.customer_has_amc_in_my_operation(uuid) to authenticated;

drop policy if exists subscriptions_select_state_ops on public.subscriptions;
create policy subscriptions_select_state_ops
on public.subscriptions for select to authenticated
using (
  public.is_state_ops()
  and (
    public.state_in_my_operation(metadata -> 'service_site_address' ->> 'state')
    or exists (
      select 1
      from public.customers c
      where c.id = subscriptions.customer_id
        and public.state_in_my_operation(c.service_default_address ->> 'state')
    )
    or exists (
      select 1
      from public.bookings b
      where b.subscription_id = subscriptions.id
        and public.state_in_my_operation(b.service_site_address ->> 'state')
    )
  )
);

drop policy if exists customers_select_state_ops on public.customers;
create policy customers_select_state_ops
on public.customers for select to authenticated
using (
  public.is_state_ops()
  and (
    public.state_in_my_operation(service_default_address ->> 'state')
    or public.customer_has_amc_in_my_operation(id)
    or exists (
      select 1
      from public.bookings b
      where b.customer_id = customers.id
        and public.state_in_my_operation(b.service_site_address ->> 'state')
    )
  )
);

drop policy if exists subscription_visit_slots_select_state_ops on public.subscription_visit_slots;
create policy subscription_visit_slots_select_state_ops
on public.subscription_visit_slots for select to authenticated
using (
  public.state_in_my_operation(public.subscription_site_state(subscription_id))
);

drop policy if exists amc_wallets_select_state_ops on public.amc_wallets;
create policy amc_wallets_select_state_ops
on public.amc_wallets for select to authenticated
using (
  public.is_state_ops()
  and (
    public.state_in_my_operation(public.subscription_site_state(subscription_id))
    or exists (
      select 1
      from public.customers c
      where c.id = amc_wallets.customer_id
        and (
          public.state_in_my_operation(c.service_default_address ->> 'state')
          or exists (
            select 1
            from public.bookings b
            where b.customer_id = c.id
              and public.state_in_my_operation(b.service_site_address ->> 'state')
          )
        )
    )
  )
);
