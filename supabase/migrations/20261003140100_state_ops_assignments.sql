-- State operations desks.
-- role = admin remains national (admin@ / partners@): no state rows, full country.
-- role = state_ops sees operational rows whose site state is assigned here.
-- Requires 20261003140000_user_role_add_state_ops.sql.

create or replace function public.coerce_user_role(raw text)
returns public.user_role
language plpgsql
immutable
as $$
begin
  return case lower(coalesce(raw, 'customer'))
    when 'customer' then 'customer'::public.user_role
    when 'vendor' then 'vendor'::public.user_role
    when 'technician' then 'technician'::public.user_role
    when 'admin' then 'admin'::public.user_role
    when 'support' then 'support'::public.user_role
    when 'state_ops' then 'state_ops'::public.user_role
    else 'customer'::public.user_role
  end;
end;
$$;

-- Privileged roles never arrive from client auth metadata.
create or replace function public.auth_user_signup_role_from_metadata(au auth.users)
returns public.user_role
language plpgsql
immutable
as $$
declare
  raw text;
  coerced public.user_role;
begin
  raw := nullif(trim(coalesce(au.raw_user_meta_data->>'role', '')), '');
  if raw is null then
    return null;
  end if;
  coerced := public.coerce_user_role(raw);
  if coerced in (
    'admin'::public.user_role,
    'support'::public.user_role,
    'state_ops'::public.user_role
  ) then
    return null;
  end if;
  return coerced;
end;
$$;

create or replace function public.prevent_unprivileged_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;
  -- Service role and national admins assign staff roles. Everyone else keeps their role.
  if auth.role() = 'service_role' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  raise exception 'Only a national admin can change a user role';
end;
$$;

drop trigger if exists users_prevent_unprivileged_role_change on public.users;
create trigger users_prevent_unprivileged_role_change
before update of role on public.users
for each row execute function public.prevent_unprivileged_role_change();

create table if not exists public.operation_states (
  id text primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_operation_states (
  user_id uuid not null references public.users (id) on delete cascade,
  state_id text not null references public.operation_states (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  primary key (user_id, state_id)
);

create index if not exists user_operation_states_state_id_idx
  on public.user_operation_states (state_id);

insert into public.operation_states (id, name) values
  ('andhra-pradesh', 'Andhra Pradesh'),
  ('arunachal-pradesh', 'Arunachal Pradesh'),
  ('assam', 'Assam'),
  ('bihar', 'Bihar'),
  ('chhattisgarh', 'Chhattisgarh'),
  ('goa', 'Goa'),
  ('gujarat', 'Gujarat'),
  ('haryana', 'Haryana'),
  ('himachal-pradesh', 'Himachal Pradesh'),
  ('jharkhand', 'Jharkhand'),
  ('karnataka', 'Karnataka'),
  ('kerala', 'Kerala'),
  ('madhya-pradesh', 'Madhya Pradesh'),
  ('maharashtra', 'Maharashtra'),
  ('manipur', 'Manipur'),
  ('meghalaya', 'Meghalaya'),
  ('mizoram', 'Mizoram'),
  ('nagaland', 'Nagaland'),
  ('odisha', 'Odisha'),
  ('punjab', 'Punjab'),
  ('rajasthan', 'Rajasthan'),
  ('sikkim', 'Sikkim'),
  ('tamil-nadu', 'Tamil Nadu'),
  ('telangana', 'Telangana'),
  ('tripura', 'Tripura'),
  ('uttar-pradesh', 'Uttar Pradesh'),
  ('uttarakhand', 'Uttarakhand'),
  ('west-bengal', 'West Bengal'),
  ('andaman-and-nicobar-islands', 'Andaman and Nicobar Islands'),
  ('chandigarh', 'Chandigarh'),
  ('dadra-and-nagar-haveli-and-daman-and-diu', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('delhi', 'Delhi'),
  ('jammu-and-kashmir', 'Jammu and Kashmir'),
  ('ladakh', 'Ladakh'),
  ('lakshadweep', 'Lakshadweep'),
  ('puducherry', 'Puducherry')
on conflict (id) do update set name = excluded.name;

create or replace function public.is_state_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'state_ops'::public.user_role
  );
$$;

create or replace function public.state_in_my_operation(state_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and nullif(trim(coalesce(state_name, '')), '') is not null
    and exists (
      select 1
      from public.user_operation_states uos
      join public.operation_states s on s.id = uos.state_id
      where uos.user_id = auth.uid()
        and s.is_active
        and lower(s.name) = lower(trim(state_name))
    );
$$;

revoke all on function public.is_state_ops() from public;
revoke all on function public.state_in_my_operation(text) from public;
grant execute on function public.is_state_ops() to authenticated;
grant execute on function public.state_in_my_operation(text) to authenticated;

alter table public.operation_states enable row level security;
alter table public.user_operation_states enable row level security;

grant select, insert, update, delete on public.operation_states to authenticated;
grant select, insert, update, delete on public.user_operation_states to authenticated;

drop policy if exists operation_states_select_staff on public.operation_states;
create policy operation_states_select_staff
on public.operation_states for select to authenticated
using (public.is_admin() or public.is_state_ops());

drop policy if exists operation_states_write_admin on public.operation_states;
create policy operation_states_write_admin
on public.operation_states for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists user_operation_states_select_scope on public.user_operation_states;
create policy user_operation_states_select_scope
on public.user_operation_states for select to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists user_operation_states_write_admin on public.user_operation_states;
create policy user_operation_states_write_admin
on public.user_operation_states for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Operational visibility for a state desk. National admin policies are unchanged.

drop policy if exists bookings_select_state_ops on public.bookings;
create policy bookings_select_state_ops
on public.bookings for select to authenticated
using (public.state_in_my_operation(service_site_address->>'state'));

drop policy if exists bookings_update_state_ops on public.bookings;
create policy bookings_update_state_ops
on public.bookings for update to authenticated
using (public.state_in_my_operation(service_site_address->>'state'))
with check (public.state_in_my_operation(service_site_address->>'state'));

drop policy if exists customers_select_state_ops on public.customers;
create policy customers_select_state_ops
on public.customers for select to authenticated
using (
  public.is_state_ops()
  and (
    public.state_in_my_operation(service_default_address->>'state')
    or exists (
      select 1
      from public.bookings b
      where b.customer_id = customers.id
        and public.state_in_my_operation(b.service_site_address->>'state')
    )
  )
);

drop policy if exists vendors_select_state_ops on public.vendors;
create policy vendors_select_state_ops
on public.vendors for select to authenticated
using (
  public.is_state_ops()
  and (
    exists (
      select 1
      from unnest(coalesce(vendors.operating_regions, '{}'::text[])) as region
      where public.state_in_my_operation(region)
    )
    or exists (
      select 1
      from public.bookings b
      where b.vendor_id = vendors.id
        and public.state_in_my_operation(b.service_site_address->>'state')
    )
  )
);

drop policy if exists technicians_select_state_ops on public.technicians;
create policy technicians_select_state_ops
on public.technicians for select to authenticated
using (
  public.is_state_ops()
  and exists (
    select 1
    from public.vendors v
    where v.id = technicians.vendor_id
      and (
        exists (
          select 1
          from unnest(coalesce(v.operating_regions, '{}'::text[])) as region
          where public.state_in_my_operation(region)
        )
        or exists (
          select 1
          from public.bookings b
          where b.vendor_id = v.id
            and public.state_in_my_operation(b.service_site_address->>'state')
        )
      )
  )
);

drop policy if exists users_select_state_ops on public.users;
create policy users_select_state_ops
on public.users for select to authenticated
using (
  public.is_state_ops()
  and (
    exists (select 1 from public.customers c where c.user_id = users.id)
    or exists (select 1 from public.technicians t where t.user_id = users.id)
    or exists (select 1 from public.vendors v where v.user_id = users.id)
  )
);

drop policy if exists payments_select_state_ops on public.payments;
create policy payments_select_state_ops
on public.payments for select to authenticated
using (
  public.is_state_ops()
  and exists (
    select 1
    from public.bookings b
    where b.id = payments.booking_id
      and public.state_in_my_operation(b.service_site_address->>'state')
  )
);

drop policy if exists vendor_settlements_select_state_ops on public.vendor_settlements;
create policy vendor_settlements_select_state_ops
on public.vendor_settlements for select to authenticated
using (
  public.is_state_ops()
  and exists (
    select 1
    from public.bookings b
    where b.id = vendor_settlements.booking_id
      and public.state_in_my_operation(b.service_site_address->>'state')
  )
);

drop policy if exists subscriptions_select_state_ops on public.subscriptions;
create policy subscriptions_select_state_ops
on public.subscriptions for select to authenticated
using (
  public.is_state_ops()
  and (
    exists (
      select 1
      from public.customers c
      where c.id = subscriptions.customer_id
        and public.state_in_my_operation(c.service_default_address->>'state')
    )
    or exists (
      select 1
      from public.bookings b
      where b.subscription_id = subscriptions.id
        and public.state_in_my_operation(b.service_site_address->>'state')
    )
  )
);

drop policy if exists job_reports_select_state_ops on public.job_reports;
create policy job_reports_select_state_ops
on public.job_reports for select to authenticated
using (
  public.is_state_ops()
  and exists (
    select 1
    from public.bookings b
    where b.id = job_reports.booking_id
      and public.state_in_my_operation(b.service_site_address->>'state')
  )
);

drop policy if exists amc_wallets_select_state_ops on public.amc_wallets;
create policy amc_wallets_select_state_ops
on public.amc_wallets for select to authenticated
using (
  public.is_state_ops()
  and exists (
    select 1
    from public.customers c
    where c.id = amc_wallets.customer_id
      and (
        public.state_in_my_operation(c.service_default_address->>'state')
        or exists (
          select 1
          from public.bookings b
          where b.customer_id = c.id
            and public.state_in_my_operation(b.service_site_address->>'state')
        )
      )
  )
);

drop policy if exists notification_events_select_state_ops on public.notification_events;
create policy notification_events_select_state_ops
on public.notification_events for select to authenticated
using (
  public.is_state_ops()
  and recipient_audience = 'admin'
  and booking_id is not null
  and exists (
    select 1
    from public.bookings b
    where b.id = notification_events.booking_id
      and public.state_in_my_operation(b.service_site_address->>'state')
  )
);
