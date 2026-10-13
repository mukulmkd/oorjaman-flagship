-- Header badge counts unread support replies that are not tied to a visit.
-- The automatic close note is not unread. Visit chats are counted separately.

create or replace function public.count_unread_support_messages_for_technician()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.support_messages m
  inner join public.support_conversations c on c.id = m.conversation_id
  where c.technician_id = public.my_technician_id()
    and c.participant_audience = 'technician'
    and c.booking_id is null
    and m.sender_role = 'admin'
    and m.created_at > coalesce(c.technician_last_read_at, c.created_at);
$$;

create or replace function public.count_unread_support_messages_for_technician_booking(p_booking_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.support_messages m
  inner join public.support_conversations c on c.id = m.conversation_id
  where c.technician_id = public.my_technician_id()
    and c.participant_audience = 'technician'
    and c.booking_id = p_booking_id
    and m.sender_role = 'admin'
    and m.created_at > coalesce(c.technician_last_read_at, c.created_at);
$$;

revoke all on function public.count_unread_support_messages_for_technician_booking(uuid) from public;
grant execute on function public.count_unread_support_messages_for_technician_booking(uuid) to authenticated;
