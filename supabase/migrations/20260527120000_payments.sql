-- Dummy payment records (INR paise). booking_id set after successful checkout when booking is created.

do $enum$
begin
  create type public.payment_status as enum ('pending', 'success', 'failed');
exception
  when duplicate_object then null;
end $enum$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists payments_customer_id_idx on public.payments (customer_id);
create index if not exists payments_booking_id_idx on public.payments (booking_id)
  where booking_id is not null;

alter table public.payments enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
on public.payments for select to authenticated
using (customer_id = public.my_customer_id() or public.is_admin());

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own
on public.payments for insert to authenticated
with check (customer_id = public.my_customer_id());

drop policy if exists payments_update_own on public.payments;
create policy payments_update_own
on public.payments for update to authenticated
using (customer_id = public.my_customer_id())
with check (customer_id = public.my_customer_id());
