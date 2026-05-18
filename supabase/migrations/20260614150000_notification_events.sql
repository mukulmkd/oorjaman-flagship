-- Notification event queue/log for marketplace and other operational notifications.

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  recipient_vendor_id uuid references public.vendors (id) on delete cascade,
  event_type text not null,
  channels jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_booking_idx on public.notification_events (booking_id, created_at desc);
create index if not exists notification_events_vendor_idx on public.notification_events (recipient_vendor_id, created_at desc);
create index if not exists notification_events_status_idx on public.notification_events (status, created_at desc);

alter table public.notification_events enable row level security;

drop policy if exists notification_events_select_scope on public.notification_events;
create policy notification_events_select_scope
on public.notification_events for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and recipient_vendor_id is not null
    and recipient_vendor_id = public.my_vendor_id()
  )
);

drop policy if exists notification_events_insert_authenticated on public.notification_events;
create policy notification_events_insert_authenticated
on public.notification_events for insert to authenticated
with check (true);

drop policy if exists notification_events_update_admin on public.notification_events;
create policy notification_events_update_admin
on public.notification_events for update to authenticated
using (public.is_admin())
with check (public.is_admin());
