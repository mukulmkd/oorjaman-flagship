-- State desks can see admin in-app notifications for their states, but mark-read
-- only allowed national admins. The portal then showed "Mark all read" and the
-- call failed with "not allowed".

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
    if public.is_admin() then
      null;
    elsif public.is_state_ops()
      and row.booking_id is not null
      and exists (
        select 1
        from public.bookings b
        where b.id = row.booking_id
          and public.state_in_my_operation(b.service_site_address->>'state')
      )
    then
      null;
    else
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
    if public.is_admin() then
      update public.notification_events
      set read_at = coalesce(read_at, now())
      where recipient_audience = 'admin' and read_at is null;
    elsif public.is_state_ops() then
      update public.notification_events ne
      set read_at = coalesce(ne.read_at, now())
      where ne.recipient_audience = 'admin'
        and ne.read_at is null
        and ne.booking_id is not null
        and exists (
          select 1
          from public.bookings b
          where b.id = ne.booking_id
            and public.state_in_my_operation(b.service_site_address->>'state')
        );
    else
      raise exception 'not allowed';
    end if;
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

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read(text) from public;
grant execute on function public.mark_all_notifications_read(text) to authenticated;
