-- Support desk phase 2: priority, internal notes, macros, first-response tracking.

create type public.support_conversation_priority as enum ('normal', 'high', 'urgent');

alter table public.support_conversations
  add column if not exists priority public.support_conversation_priority not null default 'normal',
  add column if not exists first_admin_reply_at timestamptz;

create index if not exists support_conversations_priority_idx
  on public.support_conversations (priority, last_message_at desc);

-- Allow agent-only internal notes.
alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'admin', 'system', 'internal'));

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select
on public.support_messages for select to authenticated
using (
  (
    public.is_admin()
    or exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
    )
  )
  and (
    public.is_admin()
    or support_messages.sender_role <> 'internal'
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    public.is_admin()
    and sender_role in ('admin', 'internal')
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
      end,
      first_admin_reply_at = case
        when new.sender_role = 'admin' and first_admin_reply_at is null then new.created_at
        else first_admin_reply_at
      end
  where id = new.conversation_id;
  return new;
end;
$$;

create table if not exists public.support_macros (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category_slug text,
  owner_user_id uuid references auth.users (id) on delete cascade,
  is_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_macros_team_idx
  on public.support_macros (is_team, category_slug);

create index if not exists support_macros_owner_idx
  on public.support_macros (owner_user_id);

alter table public.support_macros enable row level security;

drop policy if exists support_macros_admin on public.support_macros;
create policy support_macros_admin
on public.support_macros for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.support_macros to authenticated;

insert into public.support_macros (title, body, category_slug, is_team, owner_user_id)
select v.title, v.body, v.category_slug, true, null
from (
  values
    (
      'Checking your booking',
      'Thanks for reaching out. I''m checking your booking details now and will update you in this chat shortly.',
      null
    ),
    (
      'AMC / subscription',
      'I''m reviewing your AMC subscription and visit schedule. I''ll confirm the next steps here in a moment.',
      null
    ),
    (
      'Need a few details',
      'To help you faster, could you share your booking reference (if you have one) or the date of your last visit?',
      null
    )
) as v(title, body, category_slug)
where not exists (select 1 from public.support_macros m where m.is_team and m.title = v.title);
