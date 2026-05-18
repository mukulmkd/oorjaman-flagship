-- Who closed a chat, and per-conversation audit trail for the support desk.

alter table public.support_conversations
  add column if not exists resolved_by_user_id uuid references auth.users (id) on delete set null;

create index if not exists support_conversations_resolved_by_idx
  on public.support_conversations (resolved_by_user_id)
  where resolved_by_user_id is not null;

create table if not exists public.support_conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('desk', 'customer', 'system')),
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_conversation_events_conversation_idx
  on public.support_conversation_events (conversation_id, created_at asc);

alter table public.support_conversation_events enable row level security;

drop policy if exists support_conversation_events_select on public.support_conversation_events;
create policy support_conversation_events_select
on public.support_conversation_events for select to authenticated
using (
  public.is_support_desk_user()
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_conversation_events.conversation_id
      and c.customer_id = public.my_customer_id()
  )
);

drop policy if exists support_conversation_events_insert_desk on public.support_conversation_events;
create policy support_conversation_events_insert_desk
on public.support_conversation_events for insert to authenticated
with check (public.is_support_desk_user());

drop policy if exists support_conversation_events_insert_customer on public.support_conversation_events;
create policy support_conversation_events_insert_customer
on public.support_conversation_events for insert to authenticated
with check (
  actor_role = 'customer'
  and exists (
    select 1
    from public.support_conversations c
    where c.id = support_conversation_events.conversation_id
      and c.customer_id = public.my_customer_id()
  )
);

grant select, insert on public.support_conversation_events to authenticated;

create or replace function public.support_log_conversation_event(
  p_conversation_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_event_type text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_conversation_events (
    conversation_id,
    actor_user_id,
    actor_role,
    event_type,
    summary,
    metadata
  )
  values (
    p_conversation_id,
    p_actor_user_id,
    p_actor_role,
    p_event_type,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.support_log_conversation_event(uuid, uuid, text, text, text, jsonb) to authenticated;

create or replace function public.support_conversation_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.support_log_conversation_event(
    new.id,
    null,
    'system',
    'conversation_started',
    'Customer started a support conversation',
    jsonb_build_object('category_slug', new.category_slug, 'subcategory_slug', new.subcategory_slug)
  );
  return new;
end;
$$;

drop trigger if exists support_conversation_created_event_trg on public.support_conversations;
create trigger support_conversation_created_event_trg
after insert on public.support_conversations
for each row execute function public.support_conversation_created_event();

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
  if p_customer_id is null or (p_customer_id <> public.my_customer_id() and not public.is_admin()) then
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
        resolved_at = now(),
        updated_at = now()
    where id = rec.id;

    perform public.support_log_conversation_event(
      rec.id,
      null,
      'system',
      'auto_closed_inactivity',
      'Chat closed automatically after 30 minutes without a customer reply',
      '{}'::jsonb
    );

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
