-- Technician ↔ OorjaMan support chat (parallel audience to customer support).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_participant_audience') then
    create type public.support_participant_audience as enum ('customer', 'technician');
  end if;
end $$;

alter table public.support_conversations
  add column if not exists participant_audience public.support_participant_audience not null default 'customer',
  add column if not exists technician_id uuid references public.technicians (id) on delete cascade,
  add column if not exists last_technician_message_at timestamptz,
  add column if not exists technician_last_read_at timestamptz;

alter table public.support_conversations
  alter column customer_id drop not null;

update public.support_conversations
set participant_audience = 'customer'
where participant_audience is null;

update public.support_conversations
set technician_last_read_at = coalesce(last_message_at, created_at)
where participant_audience = 'technician' and technician_last_read_at is null;

alter table public.support_conversations
  drop constraint if exists support_conversations_participant_check;

alter table public.support_conversations
  add constraint support_conversations_participant_check check (
    (
      participant_audience = 'customer'
      and customer_id is not null
      and technician_id is null
    )
    or (
      participant_audience = 'technician'
      and technician_id is not null
      and customer_id is null
    )
  );

create index if not exists support_conversations_technician_idx
  on public.support_conversations (technician_id, last_message_at desc);

create index if not exists support_conversations_audience_status_idx
  on public.support_conversations (participant_audience, status, last_message_at desc);

-- Allow technician as message sender.
alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'technician', 'admin', 'system', 'internal'));

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
      last_technician_message_at = case
        when new.sender_role = 'technician' then new.created_at
        else last_technician_message_at
      end,
      status = case
        when new.sender_role = 'admin' and status in ('queued', 'intake') then 'active'::public.support_conversation_status
        else status
      end,
      assigned_admin_user_id = case
        when new.sender_role = 'admin' and assigned_admin_user_id is null then new.sender_user_id
        else assigned_admin_user_id
      end,
      first_admin_reply_at = case
        when new.sender_role = 'admin' and first_admin_reply_at is null then new.created_at
        else first_admin_reply_at
      end
  where id = new.conversation_id;
  return new;
end;
$$;

-- RLS: conversations
drop policy if exists support_conversations_select on public.support_conversations;
create policy support_conversations_select
on public.support_conversations for select to authenticated
using (
  public.is_admin()
  or public.is_support_agent()
  or (
    participant_audience = 'customer'
    and customer_id = public.my_customer_id()
  )
  or (
    participant_audience = 'technician'
    and technician_id = public.my_technician_id()
  )
);

drop policy if exists support_conversations_insert_customer on public.support_conversations;
create policy support_conversations_insert_customer
on public.support_conversations for insert to authenticated
with check (
  participant_audience = 'customer'
  and customer_id = public.my_customer_id()
);

drop policy if exists support_conversations_insert_technician on public.support_conversations;
create policy support_conversations_insert_technician
on public.support_conversations for insert to authenticated
with check (
  participant_audience = 'technician'
  and technician_id = public.my_technician_id()
);

drop policy if exists support_conversations_update on public.support_conversations;
create policy support_conversations_update
on public.support_conversations for update to authenticated
using (
  public.is_admin()
  or public.is_support_agent()
  or (
    participant_audience = 'customer'
    and customer_id = public.my_customer_id()
  )
  or (
    participant_audience = 'technician'
    and technician_id = public.my_technician_id()
  )
)
with check (
  public.is_admin()
  or public.is_support_agent()
  or (
    participant_audience = 'customer'
    and customer_id = public.my_customer_id()
  )
  or (
    participant_audience = 'technician'
    and technician_id = public.my_technician_id()
  )
);

-- RLS: messages
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select
on public.support_messages for select to authenticated
using (
  public.is_admin()
  or public.is_support_agent()
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.participant_audience = 'customer'
      and c.customer_id = public.my_customer_id()
  )
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.participant_audience = 'technician'
      and c.technician_id = public.my_technician_id()
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    (public.is_admin() or public.is_support_agent())
    and sender_role = 'admin'
  )
  or (
    sender_role = 'customer'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.participant_audience = 'customer'
        and c.customer_id = public.my_customer_id()
        and c.status <> 'resolved'
    )
  )
  or (
    sender_role = 'technician'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.participant_audience = 'technician'
        and c.technician_id = public.my_technician_id()
        and c.status <> 'resolved'
    )
  )
);

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
    and m.sender_role in ('admin', 'system')
    and m.created_at > coalesce(c.technician_last_read_at, c.created_at);
$$;

create or replace function public.mark_support_conversation_read_by_technician(p_conversation_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.support_conversations;
begin
  if public.my_technician_id() is null then
    raise exception 'technician profile required';
  end if;

  update public.support_conversations
  set technician_last_read_at = now(),
      updated_at = now()
  where id = p_conversation_id
    and technician_id = public.my_technician_id()
    and participant_audience = 'technician'
  returning * into row;

  if not found then
    raise exception 'conversation not found';
  end if;

  return row;
end;
$$;

grant execute on function public.count_unread_support_messages_for_technician() to authenticated;
grant execute on function public.mark_support_conversation_read_by_technician(uuid) to authenticated;

create or replace function public.close_inactive_support_chats_for_technician(p_technician_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;
  rec record;
begin
  if p_technician_id is null
    or (p_technician_id <> public.my_technician_id() and not public.is_admin() and not public.is_support_agent()) then
    return 0;
  end if;

  for rec in
    select c.id
    from public.support_conversations c
    where c.technician_id = p_technician_id
      and c.participant_audience = 'technician'
      and c.status in ('queued', 'active')
      and coalesce(c.last_technician_message_at, c.created_at) < now() - interval '30 minutes'
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

grant execute on function public.close_inactive_support_chats_for_technician(uuid) to authenticated;

create or replace function public.support_conversation_welcome_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_messages (conversation_id, sender_role, body)
  values (
    new.id,
    'system',
    case
      when new.participant_audience = 'technician' then
        'Thanks for the details. OorjaMan field support will join this chat shortly. Keep messaging here while you wait.'
      else
        'Thanks for the details. An OorjaMan support specialist will join this chat shortly. You can keep messaging here while you wait.'
    end
  );
  return new;
end;
$$;

-- Technician mobile push (mirrors customer_push_*).
create table if not exists public.technician_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'unknown')),
  app_slug text not null default 'technician-app',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists technician_push_tokens_technician_idx
  on public.technician_push_tokens (technician_id, updated_at desc);

alter table public.technician_push_tokens enable row level security;

drop policy if exists technician_push_tokens_select_own on public.technician_push_tokens;
create policy technician_push_tokens_select_own
on public.technician_push_tokens for select to authenticated
using (user_id = auth.uid());

drop policy if exists technician_push_tokens_insert_own on public.technician_push_tokens;
create policy technician_push_tokens_insert_own
on public.technician_push_tokens for insert to authenticated
with check (
  user_id = auth.uid()
  and technician_id = public.my_technician_id()
);

drop policy if exists technician_push_tokens_update_own on public.technician_push_tokens;
create policy technician_push_tokens_update_own
on public.technician_push_tokens for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and technician_id = public.my_technician_id()
);

drop policy if exists technician_push_tokens_delete_own on public.technician_push_tokens;
create policy technician_push_tokens_delete_own
on public.technician_push_tokens for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.technician_push_tokens to authenticated;

create table if not exists public.technician_push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  conversation_id uuid references public.support_conversations (id) on delete set null,
  message_id uuid references public.support_messages (id) on delete set null,
  event_type text not null default 'support_message',
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists technician_push_outbox_status_idx
  on public.technician_push_outbox (status, next_attempt_at, created_at);

alter table public.technician_push_outbox enable row level security;
revoke all on public.technician_push_outbox from authenticated;
grant all on public.technician_push_outbox to service_role;

create or replace function public.upsert_technician_push_token(
  p_expo_push_token text,
  p_platform text default 'unknown'
)
returns public.technician_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_technician_id uuid;
  row public.technician_push_tokens;
  v_platform text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  v_technician_id := public.my_technician_id();
  if v_technician_id is null then
    raise exception 'technician profile required';
  end if;

  v_platform := case
    when lower(coalesce(p_platform, '')) in ('ios', 'android') then lower(p_platform)
    else 'unknown'
  end;

  insert into public.technician_push_tokens (
    user_id,
    technician_id,
    expo_push_token,
    platform,
    last_seen_at,
    updated_at
  )
  values (
    auth.uid(),
    v_technician_id,
    trim(p_expo_push_token),
    v_platform,
    now(),
    now()
  )
  on conflict (user_id, expo_push_token) do update
  set
    technician_id = excluded.technician_id,
    platform = excluded.platform,
    last_seen_at = now(),
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

grant execute on function public.upsert_technician_push_token(text, text) to authenticated;

create or replace function public.enqueue_customer_support_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_customer_id uuid;
  v_title text;
  v_body text;
  v_event text;
  v_agent_name text;
  v_audience public.support_participant_audience;
begin
  if new.sender_role not in ('admin', 'system') then
    return new;
  end if;

  select c.participant_audience, c.customer_id, cust.user_id
  into v_audience, v_customer_id, v_user_id
  from public.support_conversations c
  left join public.customers cust on cust.id = c.customer_id
  where c.id = new.conversation_id;

  if v_audience <> 'customer' or v_user_id is null then
    return new;
  end if;

  v_event := coalesce(new.metadata ->> 'event', '');
  v_agent_name := nullif(trim(coalesce(new.metadata ->> 'agent_display_name', '')), '');

  if new.sender_role = 'system' and v_event = 'agent_joined' then
    v_title := 'OorjaMan support';
    v_body := coalesce(v_agent_name, 'Support') || ' joined your chat';
  elsif new.sender_role = 'system' and v_event = 'agent_transferred' then
    v_title := 'OorjaMan support';
    v_body := 'Your chat was transferred to ' || coalesce(v_agent_name, 'another agent');
  else
    v_title := 'New support message';
    v_body := left(trim(new.body), 200);
    if v_body = '' then
      v_body := 'You have a new reply from support';
    end if;
  end if;

  insert into public.customer_push_outbox (
    user_id,
    customer_id,
    conversation_id,
    message_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    v_customer_id,
    new.conversation_id,
    new.id,
    'support_message',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'support_message',
      'conversationId', new.conversation_id,
      'messageId', new.id
    )
  );

  return new;
end;
$$;

create or replace function public.enqueue_technician_support_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_technician_id uuid;
  v_title text;
  v_body text;
  v_event text;
  v_agent_name text;
  v_audience public.support_participant_audience;
begin
  if new.sender_role not in ('admin', 'system') then
    return new;
  end if;

  select c.participant_audience, c.technician_id, t.user_id
  into v_audience, v_technician_id, v_user_id
  from public.support_conversations c
  left join public.technicians t on t.id = c.technician_id
  where c.id = new.conversation_id;

  if v_audience <> 'technician' or v_user_id is null then
    return new;
  end if;

  v_event := coalesce(new.metadata ->> 'event', '');
  v_agent_name := nullif(trim(coalesce(new.metadata ->> 'agent_display_name', '')), '');

  if new.sender_role = 'system' and v_event = 'agent_joined' then
    v_title := 'OorjaMan support';
    v_body := coalesce(v_agent_name, 'Support') || ' joined your chat';
  elsif new.sender_role = 'system' and v_event = 'agent_transferred' then
    v_title := 'OorjaMan support';
    v_body := 'Your chat was transferred to ' || coalesce(v_agent_name, 'another agent');
  else
    v_title := 'New support message';
    v_body := left(trim(new.body), 200);
    if v_body = '' then
      v_body := 'You have a new reply from support';
    end if;
  end if;

  insert into public.technician_push_outbox (
    user_id,
    technician_id,
    conversation_id,
    message_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    v_technician_id,
    new.conversation_id,
    new.id,
    'support_message',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'support_message',
      'conversationId', new.conversation_id,
      'messageId', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists support_messages_enqueue_technician_push on public.support_messages;
create trigger support_messages_enqueue_technician_push
after insert on public.support_messages
for each row execute function public.enqueue_technician_support_push();

create or replace function public.try_dispatch_technician_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
  request_id bigint;
begin
  v_url := nullif(trim(current_setting('app.technician_push_function_url', true)), '');
  if v_url is null then
    return NEW;
  end if;

  v_secret := nullif(trim(current_setting('app.push_dispatch_secret', true)), '');

  select net.http_post(
    url := v_url,
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', v_secret
      )
    ),
    body := jsonb_build_object('outbox_id', NEW.id::text)
  )
  into request_id;

  return NEW;
exception
  when others then
    return NEW;
end;
$$;

drop trigger if exists technician_push_outbox_try_dispatch on public.technician_push_outbox;
create trigger technician_push_outbox_try_dispatch
after insert on public.technician_push_outbox
for each row execute function public.try_dispatch_technician_push_outbox();
