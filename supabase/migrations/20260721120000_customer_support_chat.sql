-- Customer ↔ OorjaMan support chat (Realtime / WebSocket via Supabase).

create type public.support_conversation_status as enum ('intake', 'queued', 'active', 'resolved');

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  category_slug text not null,
  subcategory_slug text not null,
  status public.support_conversation_status not null default 'queued',
  subject text,
  details_text text not null,
  booking_id uuid references public.bookings (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  service_address_id text,
  assigned_admin_user_id uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_conversations_customer_idx
  on public.support_conversations (customer_id, last_message_at desc);

create index if not exists support_conversations_status_idx
  on public.support_conversations (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_user_id uuid references auth.users (id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'admin', 'system')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at asc);

create or replace function public.touch_support_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_conversations_updated_at on public.support_conversations;
create trigger support_conversations_updated_at
before update on public.support_conversations
for each row execute function public.touch_support_conversation_updated_at();

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

drop trigger if exists support_messages_bump_conversation on public.support_messages;
create trigger support_messages_bump_conversation
after insert on public.support_messages
for each row execute function public.bump_support_conversation_last_message();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_conversations_select on public.support_conversations;
create policy support_conversations_select
on public.support_conversations for select to authenticated
using (
  public.is_admin()
  or customer_id = public.my_customer_id()
);

drop policy if exists support_conversations_insert_customer on public.support_conversations;
create policy support_conversations_insert_customer
on public.support_conversations for insert to authenticated
with check (customer_id = public.my_customer_id());

drop policy if exists support_conversations_update on public.support_conversations;
create policy support_conversations_update
on public.support_conversations for update to authenticated
using (public.is_admin() or customer_id = public.my_customer_id())
with check (public.is_admin() or customer_id = public.my_customer_id());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select
on public.support_messages for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.customer_id = public.my_customer_id()
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    public.is_admin()
    and sender_role = 'admin'
  )
  or (
    sender_role = 'customer'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
        and c.status <> 'resolved'
    )
  )
);

grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;

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
    'Thanks for the details. An OorjaMan support specialist will join this chat shortly. You can keep messaging here while you wait.'
  );
  return new;
end;
$$;

drop trigger if exists support_conversation_welcome_trg on public.support_conversations;
create trigger support_conversation_welcome_trg
after insert on public.support_conversations
for each row execute function public.support_conversation_welcome_message();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_conversations'
  ) then
    alter publication supabase_realtime add table public.support_conversations;
  end if;
end $$;
