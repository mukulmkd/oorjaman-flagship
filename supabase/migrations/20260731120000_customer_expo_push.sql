-- Customer mobile push: Expo token registry + outbox for support (and future) messages.

create table if not exists public.customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'unknown')),
  app_slug text not null default 'customer-app',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists customer_push_tokens_customer_idx
  on public.customer_push_tokens (customer_id, updated_at desc);

alter table public.customer_push_tokens enable row level security;

drop policy if exists customer_push_tokens_select_own on public.customer_push_tokens;
create policy customer_push_tokens_select_own
on public.customer_push_tokens for select to authenticated
using (user_id = auth.uid());

drop policy if exists customer_push_tokens_insert_own on public.customer_push_tokens;
create policy customer_push_tokens_insert_own
on public.customer_push_tokens for insert to authenticated
with check (
  user_id = auth.uid()
  and customer_id = public.my_customer_id()
);

drop policy if exists customer_push_tokens_update_own on public.customer_push_tokens;
create policy customer_push_tokens_update_own
on public.customer_push_tokens for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and customer_id = public.my_customer_id()
);

drop policy if exists customer_push_tokens_delete_own on public.customer_push_tokens;
create policy customer_push_tokens_delete_own
on public.customer_push_tokens for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.customer_push_tokens to authenticated;

create table if not exists public.customer_push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
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

create index if not exists customer_push_outbox_status_idx
  on public.customer_push_outbox (status, next_attempt_at, created_at);

alter table public.customer_push_outbox enable row level security;

-- Outbox is written by triggers (security definer); customers do not read it directly.
revoke all on public.customer_push_outbox from authenticated;
grant all on public.customer_push_outbox to service_role;

create or replace function public.upsert_customer_push_token(
  p_expo_push_token text,
  p_platform text default 'unknown'
)
returns public.customer_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  row public.customer_push_tokens;
  v_platform text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  v_customer_id := public.my_customer_id();
  if v_customer_id is null then
    raise exception 'customer profile required';
  end if;

  v_platform := case
    when lower(coalesce(p_platform, '')) in ('ios', 'android') then lower(p_platform)
    else 'unknown'
  end;

  insert into public.customer_push_tokens (
    user_id,
    customer_id,
    expo_push_token,
    platform,
    last_seen_at,
    updated_at
  )
  values (
    auth.uid(),
    v_customer_id,
    trim(p_expo_push_token),
    v_platform,
    now(),
    now()
  )
  on conflict (user_id, expo_push_token) do update
  set
    customer_id = excluded.customer_id,
    platform = excluded.platform,
    last_seen_at = now(),
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

grant execute on function public.upsert_customer_push_token(text, text) to authenticated;

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
begin
  if new.sender_role not in ('admin', 'system') then
    return new;
  end if;

  select c.customer_id, cust.user_id
  into v_customer_id, v_user_id
  from public.support_conversations c
  inner join public.customers cust on cust.id = c.customer_id
  where c.id = new.conversation_id;

  if v_user_id is null then
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

drop trigger if exists support_messages_enqueue_customer_push on public.support_messages;
create trigger support_messages_enqueue_customer_push
after insert on public.support_messages
for each row execute function public.enqueue_customer_support_push();

-- Optional: call edge function immediately when database settings are configured (see README).
create extension if not exists pg_net with schema extensions;

create or replace function public.try_dispatch_customer_push_outbox()
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
  v_url := nullif(trim(current_setting('app.customer_push_function_url', true)), '');
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

drop trigger if exists customer_push_outbox_try_dispatch on public.customer_push_outbox;
create trigger customer_push_outbox_try_dispatch
after insert on public.customer_push_outbox
for each row execute function public.try_dispatch_customer_push_outbox();

comment on function public.try_dispatch_customer_push_outbox() is
  'When app.customer_push_function_url is set (e.g. https://<ref>.supabase.co/functions/v1/send-customer-expo-push), dispatches push immediately via pg_net.';
