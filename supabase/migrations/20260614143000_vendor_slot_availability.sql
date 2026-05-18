-- Vendor slot-level availability for default-vendor marketplace claims.

create table if not exists public.vendor_slot_availability (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  day_key date not null,
  slot_id text not null,
  is_available boolean not null default true,
  capacity smallint not null default 1 check (capacity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (vendor_id, day_key, slot_id)
);

create index if not exists vendor_slot_availability_vendor_day_idx
  on public.vendor_slot_availability (vendor_id, day_key);

drop trigger if exists vendor_slot_availability_set_updated_at on public.vendor_slot_availability;
create trigger vendor_slot_availability_set_updated_at
before update on public.vendor_slot_availability
for each row execute function public.set_updated_at();

alter table public.vendor_slot_availability enable row level security;

drop policy if exists vendor_slot_availability_select_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_select_scope
on public.vendor_slot_availability for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendor_slot_availability_insert_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_insert_scope
on public.vendor_slot_availability for insert to authenticated
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendor_slot_availability_update_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_update_scope
on public.vendor_slot_availability for update to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
)
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendor_slot_availability_delete_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_delete_scope
on public.vendor_slot_availability for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);
