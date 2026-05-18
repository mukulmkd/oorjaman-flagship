insert into public.notification_templates (event_type, channel, template_key, subject, body, is_active)
values
  (
    'low_rating_followup',
    'email',
    'default',
    'Action needed: low-rated service {{reference_code}}',
    'A customer rated {{rating}}/5 for booking {{reference_code}}. Review feedback: {{feedback}}',
    true
  ),
  (
    'low_rating_followup',
    'sms',
    'default',
    null,
    'Low rating alert: {{reference_code}} got {{rating}}/5. Check feedback in admin.',
    true
  ),
  (
    'low_rating_followup',
    'whatsapp',
    'default',
    null,
    'Low rating alert for {{reference_code}}: {{rating}}/5. Please follow up with customer.',
    true
  ),
  (
    'low_rating_followup',
    'in_app',
    'default',
    'Low rating requires follow-up',
    'Booking {{reference_code}} has a low customer rating ({{rating}}/5).',
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
  ('low_rating_followup', 'email', true, false),
  ('low_rating_followup', 'sms', true, false),
  ('low_rating_followup', 'whatsapp', true, false),
  ('low_rating_followup', 'in_app', true, false)
on conflict (event_type, channel) do update
set
  enabled_demo = excluded.enabled_demo,
  enabled_live = excluded.enabled_live,
  updated_at = now();
