insert into public.notification_templates (event_type, channel, template_key, subject, body, is_active)
values
  (
    'subscription_renewal_nudge',
    'email',
    'sub_renewal_email_v1',
    'Your Oorjaman AMC is due for renewal',
    'Hi {{customer_name}}, your {{plan_name}} plan expires on {{ends_at}}. Renew now to keep uninterrupted service.',
    true
  ),
  (
    'subscription_renewal_nudge',
    'sms',
    'sub_renewal_sms_v1',
    null,
    'Oorjaman: Your {{plan_name}} plan expires on {{ends_at}}. Renew now to avoid service gap.',
    true
  ),
  (
    'subscription_renewal_nudge',
    'whatsapp',
    'sub_renewal_whatsapp_v1',
    null,
    'Hi {{customer_name}}, reminder from Oorjaman: {{plan_name}} expires on {{ends_at}}. Renew now.',
    true
  )
on conflict (event_type, channel, template_key) do update
set
  subject = excluded.subject,
  body = excluded.body,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.notification_channel_settings (event_type, channel, enabled_demo, enabled_live)
values
  ('subscription_renewal_nudge', 'email', true, false),
  ('subscription_renewal_nudge', 'sms', true, false),
  ('subscription_renewal_nudge', 'whatsapp', true, false)
on conflict (event_type, channel) do update
set
  enabled_demo = excluded.enabled_demo,
  enabled_live = excluded.enabled_live,
  updated_at = now();
