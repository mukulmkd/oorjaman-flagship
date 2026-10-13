-- Header badge counts unread support replies that are not tied to a booking.
-- The automatic close note is not unread. Booking chats are counted separately.

create or replace function public.count_unread_support_messages_for_customer()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.support_messages m
  inner join public.support_conversations c on c.id = m.conversation_id
  where c.customer_id = public.my_customer_id()
    and c.participant_audience = 'customer'
    and c.booking_id is null
    and m.sender_role = 'admin'
    and m.created_at > coalesce(c.customer_last_read_at, c.created_at);
$$;

comment on function public.count_unread_support_messages_for_customer() is
  'Unread agent replies on general chats for the signed-in customer. Booking chats and automatic close notes are excluded.';

create or replace function public.count_unread_support_messages_for_customer_booking(p_booking_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.support_messages m
  inner join public.support_conversations c on c.id = m.conversation_id
  where c.customer_id = public.my_customer_id()
    and c.participant_audience = 'customer'
    and c.booking_id = p_booking_id
    and m.sender_role = 'admin'
    and m.created_at > coalesce(c.customer_last_read_at, c.created_at);
$$;

revoke all on function public.count_unread_support_messages_for_customer_booking(uuid) from public;
grant execute on function public.count_unread_support_messages_for_customer_booking(uuid) to authenticated;
