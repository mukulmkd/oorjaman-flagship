-- Reproducibility fix (SECURITY_REVIEW H3-adjacent): guarantee the email-sync helper exists.
--
-- `apply_auth_user_to_public_users` (see 20260742000000 and the C1 hardening in
-- 20260808120000) references `public.auth_user_email_for_public_sync(auth.users)` at runtime.
-- On some environments (observed on UAT) that helper was missing — the earlier migration that
-- introduced it did not take effect — so every `auth.users` write (logins, admin updates, seed)
-- failed with: function public.auth_user_email_for_public_sync(auth.users) does not exist.
--
-- This migration re-creates it idempotently so the trigger path is safe everywhere. It is a
-- no-op where the function already exists (prod/fresh installs).

create or replace function public.auth_user_email_for_public_sync(au auth.users)
returns text
language sql
immutable
as $$
  select case
    when nullif(lower(trim(coalesce(au.email, ''))), '') like '%@oorjaman-dummy.test' then null
    else nullif(lower(trim(coalesce(au.email, ''))), '')
  end;
$$;
