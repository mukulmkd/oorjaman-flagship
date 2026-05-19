-- Vendor finance ledger: visit payouts (completed bookings) and cancellation penalties.

do $enum$
begin
  create type public.vendor_settlement_kind as enum ('visit_payout', 'cancellation_penalty');
exception
  when duplicate_object then null;
end $enum$;

do $enum$
begin
  create type public.vendor_settlement_status as enum (
    'pending_review',
    'approved',
    'settled',
    'waived'
  );
exception
  when duplicate_object then null;
end $enum$;

create table if not exists public.vendor_settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  kind public.vendor_settlement_kind not null,
  status public.vendor_settlement_status not null default 'pending_review',
  currency text not null default 'INR',
  reference_code text,
  visit_gross_paise bigint,
  platform_fee_paise bigint,
  net_payout_paise bigint,
  penalty_assessed_paise bigint,
  penalty_final_paise bigint,
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  settled_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  settled_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_settlements_visit_payout_amounts check (
    kind <> 'visit_payout'
    or (
      visit_gross_paise is not null
      and platform_fee_paise is not null
      and net_payout_paise is not null
      and net_payout_paise >= 0
    )
  ),
  constraint vendor_settlements_penalty_amounts check (
    kind <> 'cancellation_penalty'
    or penalty_final_paise is not null
  )
);

create unique index if not exists vendor_settlements_booking_kind_uidx
  on public.vendor_settlements (booking_id, kind);

create index if not exists vendor_settlements_vendor_created_idx
  on public.vendor_settlements (vendor_id, created_at desc);

create index if not exists vendor_settlements_status_idx
  on public.vendor_settlements (status, created_at desc);

drop trigger if exists vendor_settlements_set_updated_at on public.vendor_settlements;
create trigger vendor_settlements_set_updated_at
before update on public.vendor_settlements
for each row execute function public.set_updated_at();

alter table public.vendor_settlements enable row level security;

drop policy if exists vendor_settlements_select on public.vendor_settlements;
create policy vendor_settlements_select
on public.vendor_settlements for select to authenticated
using (
  public.is_admin()
  or vendor_id = public.my_vendor_id()
);

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
    join public.technicians t on t.id = b.technician_id
    where b.id = booking_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists vendor_settlements_update_admin on public.vendor_settlements;
create policy vendor_settlements_update_admin
on public.vendor_settlements for update to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.vendor_settlements is
  'OorjaMan ↔ partner money movements: visit payouts after completion; penalties after vendor-initiated cancellation of accepted visits.';
