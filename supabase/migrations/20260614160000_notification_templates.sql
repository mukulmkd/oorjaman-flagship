-- Channel templates for notification delivery adapters (demo/live switch).

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  template_key text not null,
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel, template_key)
);

create index if not exists notification_templates_event_channel_idx
  on public.notification_templates (event_type, channel, is_active);

drop trigger if exists notification_templates_set_updated_at on public.notification_templates;
create trigger notification_templates_set_updated_at
before update on public.notification_templates
for each row execute function public.set_updated_at();

alter table public.notification_templates enable row level security;

drop policy if exists notification_templates_select_authenticated on public.notification_templates;
create policy notification_templates_select_authenticated
on public.notification_templates for select to authenticated
using (public.is_admin());

drop policy if exists notification_templates_insert_admin on public.notification_templates;
create policy notification_templates_insert_admin
on public.notification_templates for insert to authenticated
with check (public.is_admin());

drop policy if exists notification_templates_update_admin on public.notification_templates;
create policy notification_templates_update_admin
on public.notification_templates for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notification_templates_delete_admin on public.notification_templates;
create policy notification_templates_delete_admin
on public.notification_templates for delete to authenticated
using (public.is_admin());

insert into public.notification_templates (event_type, channel, template_key, subject, body)
values
  ('marketplace_broadcast', 'in_app', 'default', 'New marketplace request', 'A new booking request is available to claim.'),
  ('marketplace_broadcast', 'email', 'default', 'New marketplace request', 'You have a new marketplace request. Please claim quickly.'),
  ('marketplace_broadcast', 'sms', 'default', null, 'New Oorjaman marketplace request available. Open vendor dashboard to claim.'),
  ('marketplace_broadcast', 'whatsapp', 'default', null, 'New marketplace request available on Oorjaman. Open dashboard to claim.'),
  ('marketplace_claim_won', 'in_app', 'default', 'Booking claim confirmed', 'You claimed this marketplace booking successfully.'),
  ('marketplace_claim_won', 'email', 'default', 'Booking claim confirmed', 'Your team has successfully claimed the marketplace booking.'),
  ('marketplace_claim_won', 'sms', 'default', null, 'Booking claim confirmed on Oorjaman.'),
  ('marketplace_claim_won', 'whatsapp', 'default', null, 'Booking claim confirmed on Oorjaman.')
on conflict (event_type, channel, template_key) do nothing;
