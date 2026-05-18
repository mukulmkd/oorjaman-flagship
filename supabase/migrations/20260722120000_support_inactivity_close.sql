-- Track last customer message and auto-close inactive support chats (30 minutes).

alter table public.support_conversations
  add column if not exists last_customer_message_at timestamptz,
  add column if not exists close_reason text;

comment on column public.support_conversations.close_reason is
  'inactive_timeout | resolved_by_admin | null while open';

update public.support_conversations
set last_customer_message_at = last_message_at
where last_customer_message_at is null;

create or replace function public.bump_support_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      last_customer_message_at = case
        when new.sender_role = 'customer' then new.created_at
        else last_customer_message_at
      end,
      status = case
        when new.sender_role = 'admin' and status in ('queued', 'intake') then 'active'::public.support_conversation_status
        else status
      end,
      assigned_admin_user_id = case
        when new.sender_role = 'admin' and assigned_admin_user_id is null then new.sender_user_id
        else assigned_admin_user_id
      end
  where id = new.conversation_id;
  return new;
end;
$$;

create or replace function public.close_inactive_support_chats_for_customer(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;
  rec record;
begin
  if p_customer_id is null or p_customer_id <> public.my_customer_id() and not public.is_admin() then
    return 0;
  end if;

  for rec in
    select c.id
    from public.support_conversations c
    where c.customer_id = p_customer_id
      and c.status in ('queued', 'active')
      and coalesce(c.last_customer_message_at, c.created_at)
        < now() - interval '30 minutes'
  loop
    update public.support_conversations
    set status = 'resolved',
        close_reason = 'inactive_timeout',
        updated_at = now()
    where id = rec.id;

    insert into public.support_messages (conversation_id, sender_role, body)
    values (
      rec.id,
      'system',
      'This chat was closed after 30 minutes without a reply. Start a new conversation anytime if you still need help.'
    );

    closed_count := closed_count + 1;
  end loop;

  return closed_count;
end;
$$;

grant execute on function public.close_inactive_support_chats_for_customer(uuid) to authenticated;
