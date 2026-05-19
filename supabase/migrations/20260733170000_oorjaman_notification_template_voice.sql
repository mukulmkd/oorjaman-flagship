-- OorjaMan-branded notification copy: warm, humble, value-adding (not plain alerts).

-- Marketplace (vendor)
update public.notification_templates
set
  subject = 'New solar visit on OorjaMan marketplace',
  body = 'Visit {{reference_code}} is open in your service area. Claiming quickly helps homeowners get timely panel care — thank you for showing up for them.',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'A homeowner needs you — {{reference_code}}',
  body = 'Namaste,

A new OorjaMan marketplace visit ({{reference_code}}) matches your service area. When you claim it, the customer sees that help is on the way — your response time truly matters for their peace of mind.

Open your partner dashboard to review slot and site details.

With gratitude,
Team OorjaMan',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'email' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan: Visit {{reference_code}} is open to claim on the partner marketplace. Timely claims keep customers'' solar care on track.',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'sms' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan marketplace — visit {{reference_code}} is ready for your team to claim. Homeowners count on partners who respond with care.',
  updated_at = now()
where event_type = 'marketplace_broadcast' and channel = 'whatsapp' and template_key = 'default';

update public.notification_templates
set
  subject = 'You secured the visit',
  body = 'Well done — you claimed {{reference_code}} on OorjaMan. Please assign your technician and confirm the slot so the customer knows their panels are in good hands.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Claim confirmed — {{reference_code}}',
  body = 'Your organisation has secured marketplace visit {{reference_code}}. Assign your best crew and confirm timing — we''re grateful for the trust you place in OorjaMan.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'email' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan: Claim confirmed for {{reference_code}}. Assign technician and confirm slot.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'sms' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan — you claimed visit {{reference_code}}. Assign your technician when ready; the homeowner will be notified.',
  updated_at = now()
where event_type = 'marketplace_claim_won' and channel = 'whatsapp' and template_key = 'default';

-- AMC renewal (customer)
update public.notification_templates
set
  subject = '{{customer_name}}, your OorjaMan solar care plan',
  body = 'Namaste {{customer_name}},

{{renewal_intro}}

{{renewal_cta}}

If you have already renewed, please accept our thanks and ignore this note — we are grateful for your trust.

— Team OorjaMan',
  updated_at = now()
where event_type = 'subscription_renewal_nudge' and channel = 'email' and template_key = 'sub_renewal_email_v1';

update public.notification_templates
set
  body = 'OorjaMan: {{renewal_intro}} {{renewal_cta}} Already renewed? Thank you — no action needed.',
  updated_at = now()
where event_type = 'subscription_renewal_nudge' and channel = 'sms' and template_key = 'sub_renewal_sms_v1';

update public.notification_templates
set
  body = 'Namaste {{customer_name}}, from OorjaMan — {{renewal_intro}} {{renewal_cta}} If you''ve renewed already, thank you and please ignore.',
  updated_at = now()
where event_type = 'subscription_renewal_nudge' and channel = 'whatsapp' and template_key = 'sub_renewal_whatsapp_v1';

-- Low rating follow-up (admin / ops)
update public.notification_templates
set
  subject = 'Please care for {{reference_code}} — {{rating}}/5 rating',
  body = 'A customer rated visit {{reference_code}} at {{rating}}/5.

Their words: "{{feedback}}"

We would be grateful if you read this with humility and reach out sincerely — a short call to listen often restores trust and helps us serve their home better.

— OorjaMan operations',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'email' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan: {{reference_code}} rated {{rating}}/5. Please read feedback and follow up with care.',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'sms' and template_key = 'default';

update public.notification_templates
set
  body = 'OorjaMan ops — {{reference_code}} received {{rating}}/5. Customer feedback: "{{feedback}}". A humble follow-up call is appreciated.',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'whatsapp' and template_key = 'default';

update public.notification_templates
set
  subject = 'Customer deserves a caring follow-up',
  body = 'Booking {{reference_code}} was rated {{rating}}/5. Please read their feedback and reach out with humility — your personal touch keeps OorjaMan trustworthy.',
  updated_at = now()
where event_type = 'low_rating_followup' and channel = 'in_app' and template_key = 'default';

-- Admin in-app (booking / ops)
update public.notification_templates
set
  subject = 'Marketplace is live',
  body = 'A booking was floated to trusted OorjaMan partners — the customer''s visit can be claimed or assigned from bookings.',
  updated_at = now()
where event_type = 'admin_marketplace_floated' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Partner claimed visit',
  body = 'A partner claimed a marketplace booking — review acceptance and crew assignment when you have a moment.',
  updated_at = now()
where event_type = 'admin_booking_vendor_claimed' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Crew assigned',
  body = 'A partner accepted a booking and assigned a technician — the homeowner can track progress in the OorjaMan app.',
  updated_at = now()
where event_type = 'admin_booking_vendor_accepted' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Partner could not take visit',
  body = 'A partner declined a booking — a quick reassignment keeps the customer''s solar care on schedule.',
  updated_at = now()
where event_type = 'admin_booking_vendor_rejected' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Please reassign partner',
  body = 'A partner stepped back from an accepted visit — assign another trusted crew when you can; we will keep the customer informed.',
  updated_at = now()
where event_type = 'admin_booking_needs_reassignment' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Technician updated',
  body = 'A partner reassigned the technician on a visit — the slot stays unless ops reschedules.',
  updated_at = now()
where event_type = 'admin_booking_technician_reassigned' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit underway',
  body = 'A field visit has started — panel care and safety checks are in progress on site.',
  updated_at = now()
where event_type = 'admin_booking_visit_started' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit complete',
  body = 'A field visit was marked complete — review the job report when convenient.',
  updated_at = now()
where event_type = 'admin_booking_visit_completed' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit cancelled',
  body = 'A booking was cancelled — a fresh assignment restores continuity for the homeowner.',
  updated_at = now()
where event_type = 'admin_booking_cancelled' and channel = 'in_app' and template_key = 'default';

-- Vendor in-app
update public.notification_templates
set
  subject = 'New OorjaMan visit for you',
  body = 'Operations assigned a paid booking to your organisation — please accept and assign a technician; the homeowner is counting on you.',
  updated_at = now()
where event_type = 'vendor_booking_assigned' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Your crew is on site',
  body = 'Your technician started the visit — thank you for representing OorjaMan with care.',
  updated_at = now()
where event_type = 'vendor_booking_visit_started' and channel = 'in_app' and template_key = 'default';

update public.notification_templates
set
  subject = 'Visit closed',
  body = 'Your technician completed the visit — the report is saved. Thank you for keeping their system healthy.',
  updated_at = now()
where event_type = 'vendor_booking_visit_completed' and channel = 'in_app' and template_key = 'default';
