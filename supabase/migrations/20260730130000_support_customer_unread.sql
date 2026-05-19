-- Customer support unread counts and read cursors (mobile badge + inbox).

alter table public.support_conversations
  add column if not exists customer_last_read_at timestamptz;

update public.support_conversations
set customer_last_read_at = coalesce(last_message_at, created_at)
where customer_last_read_at is null;

comment on column public.support_conversations.customer_last_read_at is
  'When the customer last viewed the thread; used for unread badge on mobile.';

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
    and m.sender_role in ('admin', 'system')
    and m.created_at > coalesce(c.customer_last_read_at, c.created_at);
$$;

comment on function public.count_unread_support_messages_for_customer() is
  'Unread agent/system messages across all conversations for the signed-in customer.';

create or replace function public.mark_support_conversation_read_by_customer(p_conversation_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.support_conversations;
begin
  if public.my_customer_id() is null then
    raise exception 'customer profile required';
  end if;

  update public.support_conversations
  set customer_last_read_at = now(),
      updated_at = now()
  where id = p_conversation_id
    and customer_id = public.my_customer_id()
  returning * into row;

  if not found then
    raise exception 'conversation not found';
  end if;

  return row;
end;
$$;

grant execute on function public.count_unread_support_messages_for_customer() to authenticated;
grant execute on function public.mark_support_conversation_read_by_customer(uuid) to authenticated;
