-- GPS pings from the technician app (foreground-only tracking in the client).

create table if not exists public.technician_locations (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now(),
  constraint technician_locations_lat_range check (lat >= -90::double precision and lat <= 90::double precision),
  constraint technician_locations_lng_range check (lng >= -180::double precision and lng <= 180::double precision)
);

create index if not exists technician_locations_technician_recorded_idx
  on public.technician_locations (technician_id, recorded_at desc);

alter table public.technician_locations enable row level security;

drop policy if exists technician_locations_select_own on public.technician_locations;
drop policy if exists technician_locations_select_vendor_team on public.technician_locations;
drop policy if exists technician_locations_select_admin on public.technician_locations;
drop policy if exists technician_locations_insert_own on public.technician_locations;

create policy technician_locations_select_own
on public.technician_locations for select to authenticated
using (technician_id = public.my_technician_id());

create policy technician_locations_select_vendor_team
on public.technician_locations for select to authenticated
using (
  exists (
    select 1
    from public.technicians t
    where t.id = technician_locations.technician_id
      and t.vendor_id is not null
      and t.vendor_id = public.my_vendor_id()
  )
);

create policy technician_locations_select_admin
on public.technician_locations for select to authenticated
using (public.is_admin());

create policy technician_locations_insert_own
on public.technician_locations for insert to authenticated
with check (technician_id = public.my_technician_id());
