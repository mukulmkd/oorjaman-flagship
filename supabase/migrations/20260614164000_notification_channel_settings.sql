-- Event/channel delivery toggles for demo/live routing.

create table if not exists public.notification_channel_settings (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  enabled_demo boolean not null default true,
  enabled_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel)
);

create index if not exists notification_channel_settings_event_channel_idx
  on public.notification_channel_settings (event_type, channel);

drop trigger if exists notification_channel_settings_set_updated_at on public.notification_channel_settings;
create trigger notification_channel_settings_set_updated_at
before update on public.notification_channel_settings
for each row execute function public.set_updated_at();

alter table public.notification_channel_settings enable row level security;

drop policy if exists notification_channel_settings_select_admin on public.notification_channel_settings;
create policy notification_channel_settings_select_admin
on public.notification_channel_settings for select to authenticated
using (public.is_admin());

drop policy if exists notification_channel_settings_insert_admin on public.notification_channel_settings;
create policy notification_channel_settings_insert_admin
on public.notification_channel_settings for insert to authenticated
with check (public.is_admin());

drop policy if exists notification_channel_settings_update_admin on public.notification_channel_settings;
create policy notification_channel_settings_update_admin
on public.notification_channel_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notification_channel_settings_delete_admin on public.notification_channel_settings;
create policy notification_channel_settings_delete_admin
on public.notification_channel_settings for delete to authenticated
using (public.is_admin());

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('marketplace_broadcast', 'in_app', true, false),
  ('marketplace_broadcast', 'email', true, false),
  ('marketplace_broadcast', 'sms', true, false),
  ('marketplace_broadcast', 'whatsapp', true, false),
  ('marketplace_claim_won', 'in_app', true, false),
  ('marketplace_claim_won', 'email', true, false),
  ('marketplace_claim_won', 'sms', true, false),
  ('marketplace_claim_won', 'whatsapp', true, false)
on conflict (event_type, channel) do nothing;
