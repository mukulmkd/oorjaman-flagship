-- Normalize legacy vendor technician invite phones to E.164 (+91 for 10-digit Indian mobiles).
-- Before: invites stored as "+9876543210" when vendors entered a bare 10-digit number.
-- Partner sign-in uses "+919876543210", so invite RLS/matching failed and onboarding stalled.

update public.vendor_technician_invites
set invite_phone_e164 = '+91' || substring(invite_phone_e164 from 2)
where invite_phone_e164 ~ '^\+[0-9]{10}$';

update public.vendor_technician_invites
set invite_phone_e164 = '+91' || regexp_replace(invite_phone_e164, '[^0-9]', '', 'g')
where invite_phone_e164 !~ '^\+'
  and length(regexp_replace(invite_phone_e164, '[^0-9]', '', 'g')) = 10;
