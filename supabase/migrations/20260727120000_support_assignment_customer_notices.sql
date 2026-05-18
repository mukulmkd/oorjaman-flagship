-- Customer-visible system notices when a support specialist is assigned, transferred, or unassigned.

create or replace function public.support_agent_public_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(sa.display_name), ''),
    nullif(trim(u.full_name), ''),
    'An OorjaMan support specialist'
  )
  from public.users u
  left join public.support_agents sa on sa.user_id = u.id
  where u.id = p_user_id;
$$;

grant execute on function public.support_agent_public_name(uuid) to authenticated;

create or replace function public.support_notify_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;
  body text;
  meta jsonb;
begin
  if new.assigned_admin_user_id is not distinct from old.assigned_admin_user_id then
    return new;
  end if;

  if new.assigned_admin_user_id is not null and old.assigned_admin_user_id is null then
    new_name := public.support_agent_public_name(new.assigned_admin_user_id);
    body := new_name || ' has joined the chat.';
    meta := jsonb_build_object(
      'event', 'agent_joined',
      'agent_user_id', new.assigned_admin_user_id,
      'agent_display_name', new_name
    );
  elsif new.assigned_admin_user_id is not null
    and old.assigned_admin_user_id is not null
    and new.assigned_admin_user_id <> old.assigned_admin_user_id then
    new_name := public.support_agent_public_name(new.assigned_admin_user_id);
    body := 'Your chat was transferred to ' || new_name || '.';
    meta := jsonb_build_object(
      'event', 'agent_transferred',
      'agent_user_id', new.assigned_admin_user_id,
      'agent_display_name', new_name
    );
  elsif new.assigned_admin_user_id is null and old.assigned_admin_user_id is not null then
    body := 'Waiting for the next available support specialist.';
    meta := jsonb_build_object('event', 'agent_left_queue');
  else
    return new;
  end if;

  insert into public.support_messages (conversation_id, sender_role, body, metadata)
  values (new.id, 'system', body, coalesce(meta, '{}'::jsonb));

  return new;
end;
$$;

drop trigger if exists support_conversations_assignment_notice on public.support_conversations;
create trigger support_conversations_assignment_notice
after update of assigned_admin_user_id on public.support_conversations
for each row execute function public.support_notify_assignment_change();
