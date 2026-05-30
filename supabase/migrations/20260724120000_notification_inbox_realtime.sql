-- In-app notification inbox: admin vs vendor audience, read state, realtime.

alter table public.notification_events
  add column if not exists recipient_audience text not null default 'vendor'
    check (recipient_audience in ('admin', 'vendor')),
  add column if not exists read_at timestamptz;

comment on column public.notification_events.recipient_audience is
  'admin = Oorjaman ops portal; vendor = partner portal (recipient_vendor_id required).';
comment on column public.notification_events.read_at is
  'When the recipient dismissed / opened the in-app notification.';

update public.notification_events
set recipient_audience = 'vendor'
where recipient_vendor_id is not null;

create index if not exists notification_events_audience_created_idx
  on public.notification_events (recipient_audience, created_at desc);

create index if not exists notification_events_vendor_unread_idx
  on public.notification_events (recipient_vendor_id, created_at desc)
  where recipient_vendor_id is not null and read_at is null;

create index if not exists notification_events_admin_unread_idx
  on public.notification_events (created_at desc)
  where recipient_audience = 'admin' and read_at is null;

-- RLS: vendors only see their vendor-scoped inbox rows.
drop policy if exists notification_events_select_scope on public.notification_events;
create policy notification_events_select_scope
on public.notification_events for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and recipient_audience = 'vendor'
    and recipient_vendor_id is not null
    and recipient_vendor_id = public.my_vendor_id()
  )
);

drop policy if exists notification_events_update_admin on public.notification_events;
create policy notification_events_update_admin
on public.notification_events for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notification_events_update_vendor_read on public.notification_events;
create policy notification_events_update_vendor_read
on public.notification_events for update to authenticated
using (
  public.is_approved_vendor_user()
  and recipient_audience = 'vendor'
  and recipient_vendor_id = public.my_vendor_id()
)
with check (
  public.is_approved_vendor_user()
  and recipient_audience = 'vendor'
  and recipient_vendor_id = public.my_vendor_id()
);

create or replace function public.mark_notification_read(p_event_id uuid)
returns public.notification_events
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.notification_events;
begin
  select * into row from public.notification_events where id = p_event_id;
  if not found then
    raise exception 'notification not found';
  end if;

  if row.recipient_audience = 'admin' then
    if not public.is_admin() then
      raise exception 'not allowed';
    end if;
  elsif row.recipient_audience = 'vendor' then
    if row.recipient_vendor_id is distinct from public.my_vendor_id() then
      raise exception 'not allowed';
    end if;
  else
    raise exception 'invalid audience';
  end if;

  update public.notification_events
  set read_at = coalesce(read_at, now())
  where id = p_event_id
  returning * into row;

  return row;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read(p_audience text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_audience not in ('admin', 'vendor') then
    raise exception 'invalid audience';
  end if;

  if p_audience = 'admin' then
    if not public.is_admin() then
      raise exception 'not allowed';
    end if;
    update public.notification_events
    set read_at = coalesce(read_at, now())
    where recipient_audience = 'admin' and read_at is null;
  else
    if not public.is_approved_vendor_user() then
      raise exception 'not allowed';
    end if;
    update public.notification_events
    set read_at = coalesce(read_at, now())
    where recipient_audience = 'vendor'
      and recipient_vendor_id = public.my_vendor_id()
      and read_at is null;
  end if;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_all_notifications_read(text) from public;
grant execute on function public.mark_all_notifications_read(text) to authenticated;

-- Realtime for in-app bell
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notification_events'
  ) then
    alter publication supabase_realtime add table public.notification_events;
  end if;
end;
$$;

-- In-app templates for booking / ops events
insert into public.notification_templates (event_type, channel, template_key, subject, body)
values
  ('admin_marketplace_floated', 'in_app', 'default', 'Marketplace opened', 'A booking was floated to partner vendors.'),
  ('admin_booking_vendor_claimed', 'in_app', 'default', 'Vendor claimed booking', 'A partner claimed a marketplace booking.'),
  ('admin_booking_vendor_accepted', 'in_app', 'default', 'Technician assigned', 'A partner accepted a booking and assigned a technician.'),
  ('admin_booking_vendor_rejected', 'in_app', 'default', 'Vendor declined', 'A partner declined a booking request.'),
  ('admin_booking_needs_reassignment', 'in_app', 'default', 'Reassignment needed', 'A partner cancelled an accepted visit - assign a new vendor.'),
  ('admin_booking_technician_reassigned', 'in_app', 'default', 'Technician changed', 'A partner reassigned the technician on a visit.'),
  ('admin_booking_visit_started', 'in_app', 'default', 'Visit started', 'A field visit has started on site.'),
  ('admin_booking_visit_completed', 'in_app', 'default', 'Visit completed', 'A field visit was marked complete.'),
  ('admin_booking_cancelled', 'in_app', 'default', 'Booking cancelled', 'A booking was cancelled.'),
  ('vendor_booking_assigned', 'in_app', 'default', 'New booking assigned', 'Operations assigned a paid booking to your organisation.'),
  ('vendor_booking_visit_started', 'in_app', 'default', 'Visit started', 'Your technician started the visit on site.'),
  ('vendor_booking_visit_completed', 'in_app', 'default', 'Visit completed', 'Your technician completed the visit.')
on conflict (event_type, channel, template_key) do nothing;

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
select v.event_type, 'in_app', true, true
from (values
  ('admin_marketplace_floated'),
  ('admin_booking_vendor_claimed'),
  ('admin_booking_vendor_accepted'),
  ('admin_booking_vendor_rejected'),
  ('admin_booking_needs_reassignment'),
  ('admin_booking_technician_reassigned'),
  ('admin_booking_visit_started'),
  ('admin_booking_visit_completed'),
  ('admin_booking_cancelled'),
  ('vendor_booking_assigned'),
  ('vendor_booking_visit_started'),
  ('vendor_booking_visit_completed')
) as v(event_type)
on conflict (event_type, channel) do nothing;
