-- Customer launch allowlist: one row per India Post PIN.
-- Seed is Guwahati Division from the India Post Assam circle office list (delivery offices).

create table if not exists public.launch_service_pincodes (
  id uuid primary key default gen_random_uuid(),
  city_key text not null
    check (city_key = lower(trim(city_key)) and length(trim(city_key)) > 0),
  city_name text not null
    check (length(trim(city_name)) > 0),
  pincode text not null
    check (pincode ~ '^[0-9]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pincode)
);

comment on table public.launch_service_pincodes is
  'PINs where OorjaMan customers can book. Inactive rows stay in the table but do not open service.';

create index if not exists launch_service_pincodes_active_city_idx
  on public.launch_service_pincodes (city_key)
  where active;

insert into public.launch_service_pincodes (city_key, city_name, pincode, active)
values
  ('guwahati', 'Guwahati', '781001', true),
  ('guwahati', 'Guwahati', '781002', true),
  ('guwahati', 'Guwahati', '781003', true),
  ('guwahati', 'Guwahati', '781004', true),
  ('guwahati', 'Guwahati', '781005', true),
  ('guwahati', 'Guwahati', '781006', true),
  ('guwahati', 'Guwahati', '781007', true),
  ('guwahati', 'Guwahati', '781008', true),
  ('guwahati', 'Guwahati', '781009', true),
  ('guwahati', 'Guwahati', '781010', true),
  ('guwahati', 'Guwahati', '781011', true),
  ('guwahati', 'Guwahati', '781012', true),
  ('guwahati', 'Guwahati', '781013', true),
  ('guwahati', 'Guwahati', '781014', true),
  ('guwahati', 'Guwahati', '781015', true),
  ('guwahati', 'Guwahati', '781016', true),
  ('guwahati', 'Guwahati', '781017', true),
  ('guwahati', 'Guwahati', '781018', true),
  ('guwahati', 'Guwahati', '781019', true),
  ('guwahati', 'Guwahati', '781020', true),
  ('guwahati', 'Guwahati', '781021', true),
  ('guwahati', 'Guwahati', '781022', true),
  ('guwahati', 'Guwahati', '781023', true),
  ('guwahati', 'Guwahati', '781024', true),
  ('guwahati', 'Guwahati', '781025', true),
  ('guwahati', 'Guwahati', '781026', true),
  ('guwahati', 'Guwahati', '781027', true),
  ('guwahati', 'Guwahati', '781028', true),
  ('guwahati', 'Guwahati', '781029', true),
  ('guwahati', 'Guwahati', '781030', true),
  ('guwahati', 'Guwahati', '781031', true),
  ('guwahati', 'Guwahati', '781032', true),
  ('guwahati', 'Guwahati', '781034', true),
  ('guwahati', 'Guwahati', '781035', true),
  ('guwahati', 'Guwahati', '781036', true),
  ('guwahati', 'Guwahati', '781037', true),
  ('guwahati', 'Guwahati', '781038', true),
  ('guwahati', 'Guwahati', '781039', true),
  ('guwahati', 'Guwahati', '781040', true),
  ('guwahati', 'Guwahati', '781101', true),
  ('guwahati', 'Guwahati', '781102', true),
  ('guwahati', 'Guwahati', '781103', true),
  ('guwahati', 'Guwahati', '781104', true),
  ('guwahati', 'Guwahati', '781120', true),
  ('guwahati', 'Guwahati', '781121', true),
  ('guwahati', 'Guwahati', '781122', true),
  ('guwahati', 'Guwahati', '781123', true),
  ('guwahati', 'Guwahati', '781124', true),
  ('guwahati', 'Guwahati', '781125', true),
  ('guwahati', 'Guwahati', '781127', true),
  ('guwahati', 'Guwahati', '781128', true),
  ('guwahati', 'Guwahati', '781129', true),
  ('guwahati', 'Guwahati', '781131', true),
  ('guwahati', 'Guwahati', '781132', true),
  ('guwahati', 'Guwahati', '781133', true),
  ('guwahati', 'Guwahati', '781134', true),
  ('guwahati', 'Guwahati', '781135', true),
  ('guwahati', 'Guwahati', '781136', true),
  ('guwahati', 'Guwahati', '781137', true),
  ('guwahati', 'Guwahati', '781141', true),
  ('guwahati', 'Guwahati', '781150', true),
  ('guwahati', 'Guwahati', '781171', true),
  ('guwahati', 'Guwahati', '781354', true),
  ('guwahati', 'Guwahati', '781364', true),
  ('guwahati', 'Guwahati', '781365', true),
  ('guwahati', 'Guwahati', '781366', true),
  ('guwahati', 'Guwahati', '781376', true),
  ('guwahati', 'Guwahati', '781380', true),
  ('guwahati', 'Guwahati', '781381', true),
  ('guwahati', 'Guwahati', '781382', true),
  ('guwahati', 'Guwahati', '782401', true),
  ('guwahati', 'Guwahati', '782402', true),
  ('guwahati', 'Guwahati', '782403', true)
on conflict (pincode) do update
set
  city_key = excluded.city_key,
  city_name = excluded.city_name,
  active = excluded.active;

alter table public.launch_service_pincodes enable row level security;

revoke all on table public.launch_service_pincodes from public, anon;
grant select on table public.launch_service_pincodes to authenticated;
grant all on table public.launch_service_pincodes to service_role;

drop policy if exists launch_service_pincodes_select_authenticated on public.launch_service_pincodes;
drop policy if exists launch_service_pincodes_insert_admin on public.launch_service_pincodes;
drop policy if exists launch_service_pincodes_update_admin on public.launch_service_pincodes;
drop policy if exists launch_service_pincodes_delete_admin on public.launch_service_pincodes;

create policy launch_service_pincodes_select_authenticated
on public.launch_service_pincodes for select to authenticated
using (active or public.is_admin());

create policy launch_service_pincodes_insert_admin
on public.launch_service_pincodes for insert to authenticated
with check (public.is_admin());

create policy launch_service_pincodes_update_admin
on public.launch_service_pincodes for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy launch_service_pincodes_delete_admin
on public.launch_service_pincodes for delete to authenticated
using (public.is_admin());

create or replace function public.enforce_launch_service_area()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_addr jsonb;
  v_pin text;
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'bookings' then
    v_addr := new.service_site_address;
  elsif tg_table_name = 'subscriptions' then
    v_addr := new.metadata -> 'service_site_address';
  else
    return new;
  end if;

  v_pin := regexp_replace(coalesce(v_addr ->> 'pincode', ''), '\D', '', 'g');

  if length(v_pin) = 6 and exists (
    select 1
    from public.launch_service_pincodes p
    where p.pincode = v_pin
      and p.active
  ) then
    return new;
  end if;

  raise exception 'OorjaMan is expanding to more cities. We will notify you when the service is available in your area.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.enforce_launch_service_area() from public, anon;
grant execute on function public.enforce_launch_service_area() to authenticated, service_role;

drop trigger if exists bookings_enforce_launch_service_area on public.bookings;
create trigger bookings_enforce_launch_service_area
before insert on public.bookings
for each row
execute function public.enforce_launch_service_area();

drop trigger if exists subscriptions_enforce_launch_service_area on public.subscriptions;
create trigger subscriptions_enforce_launch_service_area
before insert on public.subscriptions
for each row
execute function public.enforce_launch_service_area();
