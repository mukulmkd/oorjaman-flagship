-- Phase 3 (CSAT, resolution tags, escalation, attachments, insights config)
-- + dedicated `support` role and `support_agents` extension table.
-- Requires prior migration: 20260726115900_user_role_add_support.sql

create or replace function public.coerce_user_role(raw text)
returns public.user_role
language plpgsql
immutable
as $$
begin
  return case lower(coalesce(raw, 'customer'))
    when 'customer' then 'customer'::public.user_role
    when 'vendor' then 'vendor'::public.user_role
    when 'technician' then 'technician'::public.user_role
    when 'admin' then 'admin'::public.user_role
    when 'support' then 'support'::public.user_role
    else 'customer'::public.user_role
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- support_agents (role extension, like customers / technicians)
-- -----------------------------------------------------------------------------

create table if not exists public.support_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_agents_user_id_idx on public.support_agents (user_id);

drop trigger if exists support_agents_assert_role on public.support_agents;
create trigger support_agents_assert_role
before insert or update on public.support_agents
for each row execute function public.assert_user_role_extension();

drop trigger if exists support_agents_set_updated_at on public.support_agents;
create trigger support_agents_set_updated_at
before update on public.support_agents
for each row execute function public.set_updated_at();

create or replace function public.assert_user_role_extension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  select u.role into r from public.users u where u.id = new.user_id;
  if r is null then
    raise exception 'users row missing for user_id %', new.user_id;
  end if;
  if tg_table_name = 'customers' and r <> 'customer'::public.user_role then
    raise exception 'customers.user_id must reference users.role = customer';
  end if;
  if tg_table_name = 'vendors' and r <> 'vendor'::public.user_role then
    raise exception 'vendors.user_id must reference users.role = vendor';
  end if;
  if tg_table_name = 'technicians' and r <> 'technician'::public.user_role then
    raise exception 'technicians.user_id must reference users.role = technician';
  end if;
  if tg_table_name = 'support_agents' and r <> 'support'::public.user_role then
    raise exception 'support_agents.user_id must reference users.role = support';
  end if;
  return new;
end;
$$;

create or replace function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_agents sa
    where sa.user_id = auth.uid()
      and sa.is_active = true
  );
$$;

create or replace function public.is_support_desk_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_support_agent();
$$;

grant execute on function public.is_support_agent() to authenticated;
grant execute on function public.is_support_desk_user() to authenticated;

alter table public.support_agents enable row level security;

drop policy if exists support_agents_select on public.support_agents;
create policy support_agents_select
on public.support_agents for select to authenticated
using (public.is_support_desk_user() or user_id = auth.uid());

drop policy if exists support_agents_insert_admin on public.support_agents;
create policy support_agents_insert_admin
on public.support_agents for insert to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role = 'support'::public.user_role
    )
  )
);

drop policy if exists support_agents_update_admin on public.support_agents;
create policy support_agents_update_admin
on public.support_agents for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.support_agents to authenticated;

-- -----------------------------------------------------------------------------
-- Phase 3 conversation fields
-- -----------------------------------------------------------------------------

do $enum$
begin
  create type public.support_resolution_tag as enum (
    'resolved',
    'escalated',
    'duplicate',
    'policy_limitation'
  );
exception
  when duplicate_object then null;
end $enum$;

alter table public.support_conversations
  add column if not exists resolution_tag public.support_resolution_tag,
  add column if not exists resolved_at timestamptz,
  add column if not exists csat_rating smallint,
  add column if not exists csat_comment text,
  add column if not exists csat_submitted_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_note text;

alter table public.support_conversations
  drop constraint if exists support_conversations_csat_rating_chk;

alter table public.support_conversations
  add constraint support_conversations_csat_rating_chk
  check (csat_rating is null or (csat_rating >= 1 and csat_rating <= 5));

alter table public.platform_settings
  add column if not exists support_desk_config jsonb not null default jsonb_build_object(
    'timezone', 'Asia/Kolkata',
    'weekdays', jsonb_build_array(1, 2, 3, 4, 5, 6),
    'open_time', '09:00',
    'close_time', '21:00',
    'outside_hours_message',
    'Thanks for reaching out. Our support team is available 9am-9pm IST. We have queued your message and will reply when we are back online.'
  );

create table if not exists public.support_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages (id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  byte_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists support_message_attachments_message_idx
  on public.support_message_attachments (message_id);

alter table public.support_message_attachments enable row level security;

-- -----------------------------------------------------------------------------
-- RLS: support desk users (admin + support agents)
-- -----------------------------------------------------------------------------

drop policy if exists support_conversations_select on public.support_conversations;
create policy support_conversations_select
on public.support_conversations for select to authenticated
using (
  public.is_support_desk_user()
  or customer_id = public.my_customer_id()
);

drop policy if exists support_conversations_update on public.support_conversations;
create policy support_conversations_update
on public.support_conversations for update to authenticated
using (public.is_support_desk_user() or customer_id = public.my_customer_id())
with check (public.is_support_desk_user() or customer_id = public.my_customer_id());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select
on public.support_messages for select to authenticated
using (
  (
    public.is_support_desk_user()
    or exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
    )
  )
  and (
    public.is_support_desk_user()
    or support_messages.sender_role <> 'internal'
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    public.is_support_desk_user()
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

drop policy if exists support_macros_admin on public.support_macros;
create policy support_macros_desk
on public.support_macros for all to authenticated
using (public.is_support_desk_user())
with check (public.is_support_desk_user());

drop policy if exists support_message_attachments_select on public.support_message_attachments;
create policy support_message_attachments_select
on public.support_message_attachments for select to authenticated
using (
  public.is_support_desk_user()
  or exists (
    select 1
    from public.support_messages m
    join public.support_conversations c on c.id = m.conversation_id
    where m.id = support_message_attachments.message_id
      and c.customer_id = public.my_customer_id()
  )
);

drop policy if exists support_message_attachments_insert on public.support_message_attachments;
create policy support_message_attachments_insert
on public.support_message_attachments for insert to authenticated
with check (public.is_support_desk_user());

grant select, insert on public.support_message_attachments to authenticated;

-- Storage bucket for support attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists support_attachments_select on storage.objects;
create policy support_attachments_select
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    public.is_support_desk_user()
    or exists (
      select 1
      from public.support_message_attachments a
      join public.support_messages m on m.id = a.message_id
      join public.support_conversations c on c.id = m.conversation_id
      where a.storage_path = storage.objects.name
        and c.customer_id = public.my_customer_id()
    )
  )
);

drop policy if exists support_attachments_insert on storage.objects;
create policy support_attachments_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and public.is_support_desk_user()
);

-- Outside-hours notice after welcome message
create or replace function public.support_conversation_after_hours_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;
  tz text;
  local_ts timestamp;
  dow int;
  weekdays jsonb;
  open_t time;
  close_t time;
  msg text;
begin
  cfg := (
    select ps.support_desk_config
    from public.platform_settings ps
    where ps.id = 1
  );
  if cfg is null then
    return new;
  end if;

  tz := coalesce(cfg->>'timezone', 'Asia/Kolkata');
  local_ts := (now() at time zone tz)::timestamp;
  dow := extract(isodow from local_ts)::int;
  weekdays := coalesce(cfg->'weekdays', '[]'::jsonb);
  open_t := coalesce((cfg->>'open_time')::time, '09:00'::time);
  close_t := coalesce((cfg->>'close_time')::time, '21:00'::time);
  msg := coalesce(
    cfg->>'outside_hours_message',
    'Our support team will reply during business hours.'
  );

  if not exists (
    select 1
    from jsonb_array_elements_text(weekdays) d
    where d::int = dow
  ) then
    insert into public.support_messages (conversation_id, sender_role, body)
    values (new.id, 'system', msg);
    return new;
  end if;

  if local_ts::time < open_t or local_ts::time >= close_t then
    insert into public.support_messages (conversation_id, sender_role, body)
    values (new.id, 'system', msg);
  end if;

  return new;
end;
$$;

drop trigger if exists support_conversation_after_hours_trg on public.support_conversations;
create trigger support_conversation_after_hours_trg
after insert on public.support_conversations
for each row execute function public.support_conversation_after_hours_notice();

-- Desk insights (supervisor snapshot)
create or replace function public.get_support_desk_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_support_desk_user() then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    'open_count',
    (select count(*)::int from public.support_conversations where status in ('queued', 'active')),
    'queued_count',
    (select count(*)::int from public.support_conversations where status = 'queued'),
    'unassigned_count',
    (
      select count(*)::int
      from public.support_conversations
      where status in ('queued', 'active')
        and assigned_admin_user_id is null
    ),
    'resolved_24h',
    (
      select count(*)::int
      from public.support_conversations
      where status = 'resolved'
        and coalesce(resolved_at, updated_at) >= now() - interval '24 hours'
    ),
    'avg_first_reply_minutes',
    (
      select round(avg(extract(epoch from (first_admin_reply_at - created_at)) / 60.0)::numeric, 1)
      from public.support_conversations
      where first_admin_reply_at is not null
        and created_at >= now() - interval '7 days'
    ),
    'avg_csat_7d',
    (
      select round(avg(csat_rating)::numeric, 2)
      from public.support_conversations
      where csat_rating is not null
        and csat_submitted_at >= now() - interval '7 days'
    ),
    'by_category',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('category_slug', category_slug, 'count', cnt) order by cnt desc)
        from (
          select category_slug, count(*)::int as cnt
          from public.support_conversations
          where status in ('queued', 'active')
          group by category_slug
          order by cnt desc
          limit 8
        ) x
      ),
      '[]'::jsonb
    )
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_support_desk_insights() to authenticated;
