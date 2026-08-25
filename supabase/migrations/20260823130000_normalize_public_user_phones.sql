-- Normalize legacy public.users.phone values missing a leading + (common on dummy-auth accounts).
-- Invite RLS compares users.phone to vendor_technician_invites.invite_phone_e164 exactly.

update public.users
set phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g'),
    updated_at = now()
where phone is not null
  and trim(phone) <> ''
  and phone !~ '^\+'
  and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 12;
